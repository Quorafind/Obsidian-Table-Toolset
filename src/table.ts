import { debounce, MarkdownRenderer, setTooltip, Table, TableCell } from "obsidian";
import { getBorderRange, getStartAndEndPos, parseAndCompute } from "@/utils";

const getTable = (data: TableCell) => {
    let realTableRows = data.table.rows;
    const childArray = Array.from(data.table.cellChildMap.keys());
    childArray.sort((a: {
        row: number,
        col: number,
    }, b: {
        row: number,
        col: number,
    }) => {
        return a.row - b.row || a.col - b.col;
    });
    if (childArray.length > data.table.rows?.length * data.table.rows[0]?.length) {
        realTableRows = [];
        for (let i = 0; i < data.table.doc?.text?.length - 1; i++) {
            realTableRows.push([]);
            for (let j = 0; j < data.table.rows[0].length; j++) {
                realTableRows[i].push(childArray[i * data.table.rows[0].length + j]);
            }
        }
    }

    return realTableRows;
};
const getFormulaCellSet = (data: TableCell) => {
    const formulaCellSet = new Set();
    for (let i = 0; i < data.table.rows.length; i++) {
        for (let j = 0; j < data.table.rows[i].length; j++) {
            if (data.table.rows[i][j].text?.trim()?.startsWith('=')) {
                formulaCellSet.add(data.table.rows[i][j]);
            }
        }
    }

    return formulaCellSet;
};
const handleCheckboxClick = async (content: string, htmlDivElement: HTMLDivElement, targetEl: HTMLElement) => {
    const status = targetEl?.parentElement?.dataset?.task === 'x' ? 'DONE' : 'TODO';
    const todoElementList = Array.from(htmlDivElement?.querySelectorAll(`li.task-list-item`) ?? []);
    for (const element of todoElementList) {
        if (element === targetEl || element === targetEl.closest('li.task-list-item')) {
            const index = todoElementList.indexOf(element);
            const tempList = content.replace(/<br>/g, '\n').split(/\n/);

            const tasksIndex = [];
            for (let i = 0; i < tempList.length; i++) {
                if (tempList[i].trim().startsWith('- [ ]') || tempList[i].trim().startsWith('- [x]')) {
                    tasksIndex.push(i);
                }
            }
            const currentTaskIndex = tasksIndex[index];
            const currentTask = tempList[currentTaskIndex];
            tempList[currentTaskIndex] = currentTask.replace(/- \[ ] |- \[x] /g, status === 'TODO' ? '- [x] ' : '- [ ] ');
            return tempList.join('\n').trim();
        }
    }
};
const handlePointerDown = async (evt: PointerEvent, {
    text, data
}: {
    text: string,
    data: TableCell,
}, updateTrigger: () => void) => {
    const targetEl = evt.target as HTMLElement;
    if (targetEl.tagName === 'INPUT' && targetEl.hasClass('task-list-item-checkbox')) {
        evt.preventDefault();
        evt.stopPropagation();
        updateTrigger?.();
        const content = await handleCheckboxClick(text, data.contentEl, targetEl);
        data.table.updateCell(data, content?.replace(/\n/g, '<br>'));
        data.table.dispatchTable(data.row, data.col);
        updateTrigger?.();
    }
};
const debounceMap = new Map();

function getOrCreateDebounceFunction(table: Table) {
    const key = table.start + '-' + table.end;

    if (!debounceMap.has(key)) {
        const debounceFunc = debounce((cellSet: Set<TableCell>, data: TableCell) => {
            Array.from(cellSet).forEach((cell: TableCell) => {
                cell.dirty = true;
                data.table.rerenderCell(cell);
            });
        }, 500, true);
        debounceMap.set(key, debounceFunc);
    }
    return debounceMap.get(key);
}

export const handleRenderMethod = (data: TableCell, updateTrigger: () => void) => {

    const dataText = data.text;

	console.log(dataText);
    const dataTextContainsBr = dataText?.contains('<br>');
    const updateCellDebounce = getOrCreateDebounceFunction(data.table);

    let hoverTimeout: NodeJS.Timeout;
    let isMouseOver = false;
    let highlightedCells = [];

    const highlightCells = (table: TableCell[][], formula: string) => {
        const pos = getStartAndEndPos(formula);
        if (typeof pos === "string") return;
        const range = getBorderRange(table, pos.startPos, pos.endPos);
        highlightedCells = [];
        for (let i = 0; i < range.length; i++) {
            range[i].cell.el.toggleClass(['is-selected', ...range[i].border], true);
            highlightedCells.push({
                el: range[i].cell.el,
                cls: ['is-selected', ...range[i].border]
            });
        }
    };

    const clearHighlight = () => {
        highlightedCells.forEach(cell => {
            cell.el.toggleClass(cell.cls, false); // 移除高亮类
        });
        highlightedCells = []; // 重置已高亮的单元格列表
    };

    if (((data.table.rows?.length === data.table.doc?.text?.length - 2) || (data.table.rows?.length === data.table.doc?.text?.length - 1)) && !dataText?.trim().startsWith('=')) {
        const formulaCellSet = getFormulaCellSet(data);
        updateCellDebounce(formulaCellSet, data);
    }

    if (dataText && dataTextContainsBr) {
        if (!data.table && !data.table.editor.view.file) return;

        const text = dataText.replace(/<br>/g, '\n');
		console.log(text, data?.table);

		if(!data?.table?.editor?.view?.file || !data?.table?.editor) return;
		data.contentEl.empty();
		data.contentEl.toggleClass(['is-multi-line'], true);

        MarkdownRenderer.render(data.table.app, text, data.contentEl, data.table.editor.view.file, data.table.editor).then(() => {
            data.contentEl.toggleClass(['is-multi-line', 'markdown-rendered', 'markdown-preview-view'], true);
            (data.contentEl as HTMLElement).onpointerdown = async (evt: PointerEvent) => handlePointerDown(evt, {
                text,
                data
            }, updateTrigger);
        });
    }

    if (dataText && !dataTextContainsBr && dataText?.trim().startsWith('=') && !dataText?.trim().startsWith('==')) {
        const formula = dataText?.trim().slice(1);
        const table = getTable(data);
        const result = parseAndCompute(table, formula, data.col);

        if (result !== undefined) {
            data.contentEl.setText(result.toString());
            setTooltip(data.contentEl, formula);
            data.contentEl.toggleClass(['is-formula-cell', 'formula-rendered'], true);

            data.el.onmouseover = () => {
                if (!isMouseOver) {
                    isMouseOver = true;
                    hoverTimeout = setTimeout(() => highlightCells(table, formula), 200);
                }
            };

            data.el.onmouseout = () => {
                clearTimeout(hoverTimeout);
                isMouseOver = false;
                clearHighlight(); // 取消高亮
            };
        }
    }
};
