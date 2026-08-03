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

// Applicerar ett drag på en runda och returnerar en NY runda (muterar
// aldrig indata). Kastar inget — ogiltiga drag returnerar samma runda
// oförändrad, så anropande kod (Firebase-transaktionen) helt enkelt
// avbryter skrivningen.
export function applyMove(round, cellIndex, playerId, mySymbol, otherPlayerId) {
    if (!round || round.winner) return round;
    if (round.turn !== playerId) return round;
    if (round.board?.[cellIndex]) return round;

    const board = { ...round.board, [cellIndex]: mySymbol };
    const result = checkResult(board);

    return {
        ...round,
        board,
        winner: result ? result.winner : null,
        winLine: result ? result.line : null,
        turn: result ? round.turn : otherPlayerId,
    };
}
