import { TableCell } from "obsidian";

interface Position {
    row?: number;
    col?: number;
}

type FormulaFunction = (table: TableCell[][], startPos: string, endPos: string, ignoreCol: number) => number;

function parseCondition(conditionStr: string): (value: number) => boolean {
    const match = conditionStr.match(/(<=|>=|<|>|==)(\d+)/);
    if (!match) {
        throw new Error("Invalid condition format");
    }

    const [, operator, numberStr] = match;
    const number = parseFloat(numberStr);

    switch (operator) {
        case "<": return (x: number) => x < number;
        case "<=": return (x: number) => x <= number;
        case ">": return (x: number) => x > number;
        case ">=": return (x: number) => x >= number;
        case "==": return (x: number) => x === number;
        default: throw new Error("Invalid operator");
    }
}

export function getStartAndEndPos(formula: string): {
    funcName: string;
    startPos: string;
    endPos: string;
    condition: (value: number) => boolean;
} | string {
    let match = formula.match(/([A-Z]+)\((\w+):(\w+)\)/);
    let condition: (value: number) => boolean = () => true;

    if (!match) {
        // Try to match formulas with conditions, like SUMIF(A1:B2, "x > 10")
        match = formula.match(/([A-Z]+)\((\w+):(\w+),\s*"([^"]+)"\)/);
        if (!match) {
            return "error: invalid formula format";
        }

        const conditionStr = match[4];
        try {
            condition = parseCondition(conditionStr);
        } catch (error) {
            return `error: ${error.message}`;
        }
    }

    const [, funcName, startPos, endPos] = match;

    return {
        funcName,
        startPos,
        endPos,
        condition
    }
}

export function parseAndCompute(table: TableCell[][], formula: string, currentCol: number): number | string {
    const posRange = getStartAndEndPos(formula);
    let funcName: string, startPos: string, endPos: string, condition;

    if (typeof posRange === "string") {
        return posRange;
    } else {
        ({ funcName, startPos, endPos, condition } = posRange);
    }

    const functions: { [key: string]: FormulaFunction } = {
        SUM: sum,
        MAX: max,
        MIN: min,
        IF: (table, startPos, endPos, ignoreCol) => ifFunction(table, startPos, endPos, ignoreCol, condition),
        SUMIF: (table, startPos, endPos, ignoreCol) => sumIf(table, startPos, endPos, ignoreCol, condition),
    };

    if (!(funcName in functions)) {
        return "error: unsupported function";
    }

    try {
        return functions[funcName](table, startPos, endPos, currentCol);
    } catch (error) {
        return `error: ${error.message}`;
    }
}

// 解析位置，如 "A12"，转换为行和列的索引
function parsePosition(pos: string): Position {
    if (!isNaN(parseInt(pos))) {
        // 如果 pos 是数字，返回行
        return { row: parseInt(pos) - 1 };
    } else if (pos.length === 1) {
        // 如果 pos 是一个字符，返回列
        return { col: pos.charCodeAt(0) - 'A'.charCodeAt(0) };
    } else {
        // 否则返回行和列
        const col = pos.charCodeAt(0) - 'A'.charCodeAt(0);
        const row = parseInt(pos.slice(1)) - 1;
        return { col, row };
    }
}

export function getBorderRange(table: TableCell[][], startPos: string, endPos: string) {
    const start = parsePosition(startPos);
    const end = parsePosition(endPos);
    const selectedCells = [];

    const startRow = start.row !== undefined ? start.row : 0;
    const endRow = end.row !== undefined ? end.row : table.length - 1;
    const startCol = start.col !== undefined ? start.col : 0;
    const endCol = end.col !== undefined ? end.col : table[0].length - 1;

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            if (table[r] && table[r][c]) {
                const cellObj = { cell: table[r][c], row: r, col: c, border: [] };

                if (r === startRow) cellObj.border.push('top');
                if (r === endRow) cellObj.border.push('bottom');
                if (c === startCol) cellObj.border.push('left');
                if (c === endCol) cellObj.border.push('right');

                selectedCells.push(cellObj);
            }
        }
    }

    return selectedCells;
}


function getRange(table: TableCell[][], startPos: string, endPos: string, ignoreCol: number): string[] {
    const start = parsePosition(startPos);
    const end = parsePosition(endPos);
    const values: string[] = [];

    const startRow = start.row !== undefined ? start.row : 0;
    const endRow = end.row !== undefined ? end.row : table.length - 1;
    const startCol = start.col !== undefined ? start.col : 0;
    const endCol = end.col !== undefined ? end.col : table[0].length - 1;

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            if (c !== ignoreCol && table[r] && table[r][c]) {
                values.push(table[r][c].text);
            }
        }
    }

    return values;
}

// 将字符串数组转换为数字数组，忽略无法转换的值
function toNumbers(values: string[]): number[] {
    return values.map(v => parseFloat(v)).filter(v => !isNaN(v));
}

function sum(table: TableCell[][], startPos: string, endPos: string, ignoreCol: number): number {
    const values = toNumbers(getRange(table, startPos, endPos, ignoreCol));
    return values.reduce((acc, val) => acc + val, 0);
}

function max(table: TableCell[][], startPos: string, endPos: string, ignoreCol: number): number {
    const values = toNumbers(getRange(table, startPos, endPos, ignoreCol));
    return Math.max(...values);
}

function min(table: TableCell[][], startPos: string, endPos: string, ignoreCol: number): number {
    const values = toNumbers(getRange(table, startPos, endPos, ignoreCol));
    return Math.min(...values);
}

// IF 和 SUMIF 函数的实现稍微复杂一些，因为它们需要额外的条件参数
export function ifFunction(table: TableCell[][], startPos: string, endPos: string, ignoreCol: number, condition: (value: number) => boolean): number {
    const start = parsePosition(startPos);
    const end = parsePosition(endPos);

    let startValue: number;
    let endValue: number;

    if (start.row !== undefined && start.col !== undefined) {
        startValue = parseFloat(table[start.row][start.col].text);
    } else {
        startValue = Math.max(...toNumbers(getRange(table, startPos, startPos, ignoreCol)));
    }

    if (end.row !== undefined && end.col !== undefined) {
        endValue = parseFloat(table[end.row][end.col].text);
    } else {
        endValue = Math.max(...toNumbers(getRange(table, endPos, endPos, ignoreCol)));
    }

    return condition(startValue) && condition(endValue) ? 1 : 0;
}


function sumIf(table: TableCell[][], startPos: string, endPos: string, ignoreCol: number, condition: (value: number) => boolean): number {
    const filteredValues = getRange(table, startPos, endPos, ignoreCol)
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v) && condition(v));
    return filteredValues.reduce((acc, val) => acc + val, 0);
}
