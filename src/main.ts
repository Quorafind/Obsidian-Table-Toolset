import { debounce, MarkdownRenderer, Plugin, requireApiVersion } from 'obsidian';
import { around } from "monkey-around";
import { getBorderRange, parseAndCompute } from "./utils";

const getTable = (data: any) => {
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
	if(childArray.length > data.table.rows?.length * data.table.rows[0]?.length) {
		realTableRows = [];
		for(let i = 0; i < data.table.doc?.text?.length - 1; i++) {
			realTableRows.push([]);
			for(let j = 0; j < data.table.rows[0].length; j++) {
				realTableRows[i].push(childArray[i * data.table.rows[0].length + j]);
			}
		}
	}

	return realTableRows;
}

const getFormulaCellSet = (data: any) => {
	const formulaCellSet = new Set();
	for(let i = 0; i < data.table.rows.length; i++) {
		for(let j = 0; j < data.table.rows[i].length; j++) {
			if(data.table.rows[i][j].text?.trim()?.startsWith('=')) {
				formulaCellSet.add(data.table.rows[i][j]);
			}
		}
	}

	return formulaCellSet;
}

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
			tempList[currentTaskIndex] = currentTask.replace(/- \[ \] |- \[x\] /g, status === 'TODO' ? '- [x] ' : '- [ ] ');
			return tempList.join('\n').trim();
		}
	}
}

const handlePointerDown = async (evt: PointerEvent, {
	text, data
}: {
	text: string,
	data: any,
}, updateTrigger: ()=> void) => {
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

function getOrCreateDebounceFunction(table: any) {
	const key = table.start + '-' + table.end;
	console.log(key);

	if (!debounceMap.has(key)) {
		const debounceFunc = debounce((cellSet: Set<any>, data: any) => {
			Array.from(cellSet).forEach((cell: any) => {
				console.log("hello");
				cell.dirty = true;
				data.table.rerenderCell(cell);
			});
		}, 500, true);
		debounceMap.set(key, debounceFunc);
	}
	return debounceMap.get(key);
}


const handleRenderMethod = (data: any, updateTrigger: ()=>void) => {
	const dataText = data.text;
	const dataTextContainsBr = dataText?.contains('<br>');
	const updateCellDebounce = getOrCreateDebounceFunction(data.table);

	if(((data.table.rows?.length === data.table.doc?.text?.length - 2) || (data.table.rows?.length === data.table.doc?.text?.length - 1)) && !dataText?.trim().startsWith('=')) {
		const formulaCellSet = getFormulaCellSet(data);
		updateCellDebounce(formulaCellSet, data);
	}

	if(dataText && dataTextContainsBr) {
		if(!data.table && !data.table.editor.view.file) return;

		const text = dataText.replace(/<br>/g, '\n');
		data.contentEl.empty();
		MarkdownRenderer.render(data.table.app, text, data.contentEl, data.table.editor.view.file, data.table.editor).then(()=>{
			data.contentEl.toggleClass(['is-multi-line', 'markdown-rendered', 'markdown-preview-view'], true);
			(data.contentEl as HTMLElement).onpointerdown = async (evt: PointerEvent) => handlePointerDown(evt, {
				text,
				data
			}, updateTrigger);
		})
	}

	if(dataText && !dataTextContainsBr && dataText?.trim().startsWith('=') && !dataText?.trim().startsWith('==')) {

		const formula = dataText?.trim().slice(1);
		const table = getTable(data);
		const result = parseAndCompute(table, formula, data.col);
		if(result !== undefined) {
			data.contentEl.setText(result.toString());
			data.contentEl.toggleClass(['is-formula-cell', 'formula-rendered'], true);
			data.contentEl.onmouseover = () => {
				const tableRange = getBorderRange(table, )
			}
		}
	}
}

export default class TableToolsPlugin extends Plugin {
	patched = false;
	renderVar: any;
	triggerBySelf = false;

	async onload() {
		this.patchTableRender();

		this.registerEvent(
			this.app.workspace.on('patch-table', (table: any) => {
				this.register(
					this.patchTable(table)
				)
			})
		)
	}

	onunload() {

	}

	patchTable(table: any) {
		const updateTrigger = () => {
			this.triggerBySelf = !this.triggerBySelf;
		}

		const getTriggerStatus = () => {
			return this.triggerBySelf;
		}

		return around(table.constructor.prototype, {
			postProcess: (next: any) => {
				return function (data: any) {
					next.call(this, data);
					handleRenderMethod(data, updateTrigger);
				}
			},
			receiveSelection: (next: any) => {
				return function (...data: any) {
					if(getTriggerStatus()) {
						return;
					}
					return next.call(this, ...data);
				}
			},
			receiveCellFocus: (next: any) => {
				return function (...data: any) {
					if(getTriggerStatus()) {
						return;
					}
					return next.call(this, ...data);
				}
			}
		})
	}

	patchTableRender() {
		if (!requireApiVersion('1.5.0')) return;

		const setVar = (a: any) => {
			if(this.renderVar) return;
			this.renderVar = a;
			this.app.workspace.trigger('patch-table', a.table);
		}

		const checkPatched = () => {
			return this.patched;
		};

		const togglePatched = (uninstaller: ()=>void) => {
			this.patched = !this.patched;
			uninstaller();
		};

		const uninstaller = around(Map.prototype, {
			set: (next: any) =>
				function (...data) {
					const result = next.call(this, ...data);
					if(!checkPatched() && typeof data[0] === "object" && data[0]?.table) {
						setVar(data[0]);
						togglePatched(uninstaller);
					}
					return result;

				},
		});
		this.register(uninstaller);

		console.log('Table-Render-Enhancer: table patched');
	}

}
