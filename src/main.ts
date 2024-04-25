import { Plugin, requireApiVersion, Table, TableCell } from 'obsidian';
import { around } from "monkey-around";
import { handleRenderMethod } from "@/table";


export default class TableToolsPlugin extends Plugin {
	patched = false;
	renderVar: TableCell;
	triggerBySelf = false;

	async onload() {
		this.patchTableRender();

		this.registerEvent(
			this.app.workspace.on('patch-table', (table: Table) => {
				this.register(
					this.patchTable(table)
				)
			})
		)
	}

	onunload() {

	}

	patchTable(table: Table) {
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
					console.log(this);
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
			},
			pasteSelection: (next: any) => {
				return async function (data: ClipboardEvent) {
					next.call(this, data);

					const text = data.clipboardData.getData('text/plain');
					if(!text) return;
					if(!this.selectedCells) return;
					const cells = this.selectedCells;

					if(!(cells.length > 1)) return;
					if (text.split('\n').length > 1) {
						// 去除空行
						const newText = text.split('\n').filter((line: string) => line.trim() !== '').join('\n');
						const rowList = newText.split('\n');
						const cells = this.selectedCells;

						cells.sort((a: TableCell, b: TableCell) => {
							return a.row - b.row || a.col - b.col;
						});

						for (let i = 0; i < cells.length; i++) {
							await this.updateCell(cells[i], rowList[i]?.replace(/\n/g, '<br>'));
							setTimeout(async () => {
								await this.dispatchTable(cells[i].row, cells[i].col);
								updateTrigger();
							}, 0)
						}
					}
				}
			}
		})
	}

	patchTableRender() {
		if (!requireApiVersion('1.5.0')) return;

		const setVar = (a: TableCell) => {
			if(this.renderVar) return;
			this.renderVar = a;
			this.app.workspace.trigger('patch-table', a.table);
			a.table.rebuildTable();
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

		console.log('Table-ToolSet: table patched');
	}

}
