// connectfour.js — 4 i rad på ett klassiskt 7×6-bräde.
//
// Man klickar var som helst i en kolumn (inte en specifik ruta) — brickan
// "faller" till den lägsta lediga raden i den kolumnen genom gravitationen.
// Fyra i rad vågrätt, lodrätt eller diagonalt (åt båda hållen) vinner.
//
// Ren spellogik (inga sidoeffekter, inget DOM/Firebase) + de UI-hooks
// (cellInteractable/onCellClick/statusText) som gör att ui.js/main.js kan
// vara generiska över vilket spel som spelas — brädet återanvänder samma
// enkla rutnäts-rendering som Luffarschack/Othello (game.renderBoard sätts
// INTE), bara cellInteractable begränsar vilken enskild ruta (landningsrutan
// längst ner i varje ledig kolumn) som faktiskt är klickbar.

export const meta = {
    id: "connectfour",
    label: "4 i rad",
    description: "Släpp brickor i en kolumn — först med 4 i rad (vågrätt, lodrätt eller diagonalt) vinner.",
    rows: 6,
    cols: 7,
    boardClass: "board--connectfour",
    showGlyph: false,
};

const ROWS = 6;
const COLS = 7;
const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // vågrätt, lodrätt, diagonal \, diagonal /

function idx(row, col) { return row * COLS + col; }
function inBounds(row, col) { return row >= 0 && row < ROWS && col >= 0 && col < COLS; }

// Lägsta (understa) lediga raden i en kolumn, eller -1 om kolumnen är full.
export function lowestEmptyRow(board, col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (!board?.[idx(row, col)]) return row;
    }
    return -1;
}

function isBoardFull(board) {
    for (let col = 0; col < COLS; col++) if (lowestEmptyRow(board, col) !== -1) return false;
    return true;
}

// Letar efter fyra-i-rad genom den nyss placerade brickan (row, col) i alla
// fyra riktningsaxlar. Returnerar hela den sammanhängande raden (kan bli
// längre än 4) för snyggare highlight, eller null om ingen vinst.
function checkWinFrom(board, row, col, symbol) {
    for (const [dr, dc] of DIRECTIONS) {
        const line = [idx(row, col)];
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r, c) && board?.[idx(r, c)] === symbol) {
            line.push(idx(r, c));
            r += dr;
            c += dc;
        }
        r = row - dr;
        c = col - dc;
        while (inBounds(r, c) && board?.[idx(r, c)] === symbol) {
            line.push(idx(r, c));
            r -= dr;
            c -= dc;
        }
        if (line.length >= 4) return line;
    }
    return null;
}

export function createBoard() {
    return {};
}

export function symbolLabel(symbol) {
    return symbol;
}

export function applyAction(round, action, playerId, mySymbol, otherPlayerId) {
    if (!round || round.winner) return round;
    if (round.turn !== playerId) return round;
    if (!action || action.type !== "drop") return round;
    const col = action.col;
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return round;

    const row = lowestEmptyRow(round.board, col);
    if (row === -1) return round; // kolumnen är full

    const board = { ...round.board, [idx(row, col)]: mySymbol };
    const line = checkWinFrom(board, row, col, mySymbol);
    const winner = line ? mySymbol : (isBoardFull(board) ? "draw" : null);
    const winLine = line || null;

    return { ...round, board, winner, winLine, turn: winner ? round.turn : otherPlayerId };
}

// Bara landningsrutan (understa lediga raden) i en icke-full kolumn räknas
// som interaktiv — det gör att exakt EN ruta per ledig kolumn blir klickbar
// och visar spelaren precis var brickan hamnar, samtidigt som resten av
// ui.js:s generiska rutnäts-rendering (inklusive `hint`-markering) fungerar
// utan ändringar.
export function cellInteractable({ board, cellIndex, myTurn }) {
    if (!myTurn) return false;
    const col = cellIndex % COLS;
    const row = lowestEmptyRow(board, col);
    if (row === -1) return false;
    return idx(row, col) === cellIndex;
}

export function onCellClick({ board, mySymbol, cellIndex, sendAction }) {
    const col = cellIndex % COLS;
    const row = lowestEmptyRow(board, col);
    if (row === -1 || idx(row, col) !== cellIndex) return;
    void mySymbol; // symbolen sätts av rooms.js/applyAction utifrån vem som skickar draget
    sendAction({ type: "drop", col });
}

export function statusText({ myTurn }) {
    return myTurn ? "Din tur — släpp en bricka" : "Motståndarens tur…";
}
