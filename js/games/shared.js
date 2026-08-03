// shared.js
// Små hjälpfunktioner som är gemensamma för alla spelmoduler (inte
// specifika för ett enskilt spels regler).

// Bräda representeras som en Firebase-vänlig map { "0": "X", "3": "O", ... }
// istället för en array, eftersom Firebase gör om glesa arrayer till
// objekt ändå — bättre att äga det formatet själva.
export function boardToCells(board, cellCount) {
    const cells = new Array(cellCount).fill(null);
    for (let i = 0; i < cellCount; i++) cells[i] = board?.[i] ?? null;
    return cells;
}

export function otherSymbolOf(symbol) {
    return symbol === "X" ? "O" : "X";
}
