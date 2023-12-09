import 'obsidian';

declare module 'obsidian' {
    interface Workspace {
        on(name: 'patch-table', callback: (table: any) => void, ctx?: any): EventRef;
    }
}
