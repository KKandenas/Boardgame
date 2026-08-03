// game.js
// Ren spellogik för luffarschack (tre i rad). Inga sidoeffekter, ingen
// Firebase-import här — bara funktioner som tar state in och lämnar
// nytt state (eller ett resultat) ut. Gör att båda spelarnas klienter
// alltid kommer fram till exakt samma svar givet samma bräda.

export const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rader
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // kolumner
    [0, 4, 8], [2, 4, 6],            // diagonaler
];

// Bräda representeras som en Firebase-vänlig map { "0": "X", "3": "O", ... }
// istället för en array, eftersom Firebase gör om glesa arrayer till objekt
// ändå — bättre att äga det formatet själva.
export function emptyBoard() {
    return {};
}

export function boardToCells(board) {
    const cells = new Array(9).fill(null);
    for (let i = 0; i < 9; i++) cells[i] = board?.[i] ?? null;
    return cells;
}

export function isBoardFull(board) {
    for (let i = 0; i < 9; i++) if (!board?.[i]) return false;
    return true;
}

// Returnerar { winner: 'X'|'O', line: [a,b,c] } vid vinst,
// { winner: 'draw' } vid oavgjort, annars null (spelet pågår).
export function checkResult(board) {
    for (const line of WIN_LINES) {
        const [a, b, c] = line;
        const va = board?.[a];
        if (va && va === board?.[b] && va === board?.[c]) {
            return { winner: va, line };
        }
    }
    if (isBoardFull(board)) return { winner: "draw", line: null };
    return null;
}

export function winsNeeded(bestOf) {
    return Math.floor(bestOf / 2) + 1;
}

// Varje spelare har bara 3 brickor. Så länge man har färre än så på
// brädet placerar man ut nya; därefter flyttar man en befintlig bricka
// till valfri tom ruta istället. Eftersom turerna alternerar strikt
// 1-mot-1 hamnar båda spelarna i flyttfasen samtidigt (efter drag 6).
export const MARKERS_PER_PLAYER = 3;

export function countMarks(board, symbol) {
    let count = 0;
    for (let i = 0; i < 9; i++) if (board?.[i] === symbol) count++;
    return count;
}

export function isPlacingPhase(board, symbol) {
    return countMarks(board, symbol) < MARKERS_PER_PLAYER;
}

// Bygger en ny, tom runda. `startingPlayerId` är vem som får lägga X
// (och därmed börjar) den här rundan.
export function createRound(roundNumber, startingPlayerId) {
    return {
        roundNumber,
        board: emptyBoard(),
        turn: startingPlayerId,
        startingPlayer: startingPlayerId,
        winner: null,
        winLine: null,
        scored: false,
    };
}

// Applicerar en handling på en runda och returnerar en NY runda (muterar
// aldrig indata). Kastar inget — ogiltiga handlingar returnerar samma
// runda oförändrad (samma referens), så anropande kod (Firebase-
// transaktionen) helt enkelt avbryter skrivningen.
//
// `action` är antingen { type: "place", cell } (placeringsfasen, tills
// spelaren har MARKERS_PER_PLAYER brickor ute) eller
// { type: "move", from, to } (flyttfasen därefter — flytta en egen
// bricka till valfri tom ruta).
export function applyAction(round, action, playerId, mySymbol, otherPlayerId) {
    if (!round || round.winner) return round;
    if (round.turn !== playerId) return round;

    const placing = isPlacingPhase(round.board, mySymbol);
    let board;

    if (placing) {
        if (!action || action.type !== "place") return round;
        if (round.board?.[action.cell]) return round; // upptagen ruta
        board = { ...round.board, [action.cell]: mySymbol };
    } else {
        if (!action || action.type !== "move") return round;
        if (round.board?.[action.from] !== mySymbol) return round; // inte min bricka
        if (round.board?.[action.to]) return round; // upptagen ruta
        board = { ...round.board };
        delete board[action.from];
        board[action.to] = mySymbol;
    }

    const result = checkResult(board);
    return {
        ...round,
        board,
        winner: result ? result.winner : null,
        winLine: result ? result.line : null,
        turn: result ? round.turn : otherPlayerId,
    };
}
