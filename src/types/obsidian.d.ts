import 'obsidian';
import { App, EventRef } from "obsidian";

declare module 'obsidian' {
    interface Workspace {
        on(name: 'patch-table', callback: (table: Table) => void, ctx?: any): EventRef;
    }

    interface TableCell {
        col: number;
        contentEl: HTMLDivElement;
        dirty: boolean;
        el: HTMLElement;
        offset: number;
        row: number;
        table: Table;
        text: string;
    }

    interface Table {
        alignments: string[];
        app: App;
        cellChildMap: Map<TableCell, string>;
        children: TableCell[];
        containerEl: HTMLElement;
        doc: TableDoc;
        editor: any;
        end: number;
        start: number;
        isMalformed: boolean;
        isRendering: boolean;

        renderCallbacks: Function[];
        rows: TableCell[][];
        selectedCells: TableCell[];

        selectionAnchor: TableCell;
        selectionHead: TableCell;

        tableEl: HTMLElement;
        updateCellReadOnly: () => void;

        rerenderCell: (cell: TableCell) => void;
        postProcess: (cell: TableCell) => void;

        receiveCellFocus: (cell: TableCell | TableCell[]) => void;
        receiveSelection: (cell: TableCell | TableCell[]) => void;

        updateCell: (cell: TableCell, text: string) => void;
        dispatchTable: (row: number, col: number) => void;
    }

    interface TableDoc {
        length: number;
        text: string[];
    }
}
