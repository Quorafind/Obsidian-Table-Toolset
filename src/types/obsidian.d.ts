import 'obsidian';
import { Menu } from "obsidian";

declare module 'obsidian' {
    interface Workspace {
        on(name: 'patch-table', callback: (table: any) => void, ctx?: any): EventRef;
    }
}
