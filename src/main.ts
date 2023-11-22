import { MarkdownRenderer, Plugin, requireApiVersion } from 'obsidian';
import { around } from "monkey-around";

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

export default class MyPlugin extends Plugin {
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
					const result = next.call(this, data);
					if(data.text && data.text?.contains('<br>')) {

						if(!data.table && !data.table.editor.view.file) return;
						const text = data.text.replace(/<br>/g, '\n');
						data.contentEl.empty();
						MarkdownRenderer.render(data.table.app, text, data.contentEl, data.table.editor.view.file, data.table.editor).then(()=>{
							data.contentEl.toggleClass(['is-multi-line', 'markdown-rendered', 'markdown-preview-view'], true);
							(data.contentEl as HTMLElement).onpointerdown = async (evt: PointerEvent) => {
								const targetEl = evt.target as HTMLElement;
								if (targetEl.tagName === 'INPUT' && targetEl.hasClass('task-list-item-checkbox')) {
									evt.preventDefault();
									evt.stopPropagation();
									updateTrigger();
									const content = await handleCheckboxClick(text, data.contentEl, targetEl);
									data.table.updateCell(data, content?.replace(/\n/g, '<br>'));
									data.table.dispatchTable(data.row, data.col);
									updateTrigger();
								}
							};
						})
					}
					return result;
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
						console.log(data[0]);
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
