// rooms.js
// Rumshantering: skapa/gå med, drag, rond-/matchövergångar och
// spelaridentitet. All skrivning som avgör spelutgången görs via
// dbTransact på hela rum-noden — det gör operationerna idempotenta så att
// BÅDA spelarnas klienter kan räkna ut och skriva samma resultat utan att
// krocka. Helt agnostisk om VILKET spel som spelas — det avgörs av
// registret i js/games/registry.js (room.gameType pekar ut modulen).

import { paths, dbGet, dbSet, dbTransact, dbListen, registerPresence } from "./firebase.js?v=14";
import { getGame, DEFAULT_GAME_ID } from "./games/registry.js?v=14";
import { winsNeeded } from "./games/shared.js?v=14";

// Spel kan lägga till egna initiala fält på runde-nivå (t.ex. backgammons
// dubbleringstärning) via en valfri game.initialRoundState()-hook.
function createRound(gameId, roundNumber, startingPlayerId) {
    const game = getGame(gameId);
    const extra = game.initialRoundState ? game.initialRoundState() : {};
    return {
        roundNumber,
        board: game.createBoard(),
        turn: startingPlayerId,
        startingPlayer: startingPlayerId,
        winner: null,
        winLine: null,
        pointValue: 1,
        scored: false,
        ...extra,
    };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // utan I, O, 0, 1 — lätta att förväxla
const CODE_LENGTH = 4;

function generateCode() {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
}

export function normalizeCode(input) {
    return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

function defaultName(symbol) {
    return symbol === "X" ? "Spelare 1" : "Spelare 2";
}

function generatePlayerId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `p-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function storageKey(code) { return `luffarschack:${code}`; }

export function getStoredPlayerId(code) {
    try { return localStorage.getItem(storageKey(code)); } catch { return null; }
}

function storePlayerId(code, playerId) {
    try { localStorage.setItem(storageKey(code), playerId); } catch { /* privat läge, strunta i det */ }
}

export function forgetRoom(code) {
    try { localStorage.removeItem(storageKey(code)); } catch { /* no-op */ }
}

async function claimUniqueCode() {
    for (let attempt = 0; attempt < 12; attempt++) {
        const code = generateCode();
        const { committed } = await dbTransact(paths.room(code), (current) => {
            if (current !== null) return undefined; // upptagen kod, avbryt
            return { claiming: true, claimedAt: Date.now() };
        });
        if (committed) return code;
    }
    throw new Error("Kunde inte hitta en ledig rumskod. Försök igen.");
}

export async function createRoom(gameId, bestOf, name) {
    const code = await claimUniqueCode();
    const playerId = generatePlayerId();
    const room = {
        gameId: gameId || DEFAULT_GAME_ID,
        bestOf,
        hostId: playerId,
        createdAt: Date.now(),
        status: "waiting",
        players: {
            [playerId]: { symbol: "X", name: name || defaultName("X"), connected: true, joinedAt: Date.now() },
        },
        score: { [playerId]: 0 },
        round: null,
        matchWinner: null,
    };
    await dbSet(paths.room(code), room);
    storePlayerId(code, playerId);
    registerPresence(code, playerId);
    return { code, playerId, room };
}

export async function joinRoom(codeInput, name) {
    const code = normalizeCode(codeInput);
    if (code.length !== CODE_LENGTH) throw new Error("Ange en giltig 4-teckens rumskod.");

    // Medveten avvikelse från mönstret i övriga filen: EN bekräftad läsning
    // + EN vanlig skrivning, INGEN dbTransact. En transaktion på en sökväg
    // klienten aldrig synkat lokalt (första gången den här spelarens enhet
    // någonsin rör vid rummet) kan få sin uppdateringsfunktion anropad med
    // ett GISSAT `null` innan Firebase hunnit fråga servern — och eftersom
    // vår logik då avbryter permanent (utan att någonsin verifiera mot
    // servern på riktigt) gav det felaktigt "Rummet hittades inte" trots
    // att rummet fanns. Samma mönster som redan används i Noir Syndicates
    // joinRoom (players.js), som aldrig haft det här problemet. Risken vi
    // accepterar: om två spelare skulle gå med i exakt samma millisekund
    // kan den sista skrivningen skriva över den första — försumbart för ett
    // rum med plats för bara två spelare.
    let room;
    try {
        room = await dbGet(paths.room(code));
    } catch (err) {
        // Skiljer ut ett riktigt Firebase-fel (t.ex. behörighet nekad) från
        // "rummet finns inte" — annars ser båda likadana ut för spelaren.
        throw new Error(`Kunde inte läsa rummet (${err.code || err.message || "okänt fel"}).`);
    }
    if (!room) throw new Error(`Rummet hittades inte (kod: ${code}). Kontrollera koden.`);

    const storedId = getStoredPlayerId(code);
    const newId = storedId || generatePlayerId();
    const players = room.players || {};

    if (players[newId]) {
        // Spelaren är redan med (t.ex. sidan laddades om) — markera bara ansluten.
        await dbSet(paths.player(code, newId), { ...players[newId], connected: true });
        storePlayerId(code, newId);
        registerPresence(code, newId);
        return { code, playerId: newId, room };
    }

    const ids = Object.keys(players);
    if (ids.length >= 2) throw new Error("Rummet är redan fullt.");

    const symbol = ids.length === 0 ? "X" : (players[ids[0]].symbol === "X" ? "O" : "X");
    const updatedPlayers = {
        ...players,
        [newId]: { symbol, name: name || defaultName(symbol), connected: true, joinedAt: Date.now() },
    };
    const updatedScore = { ...(room.score || {}), [newId]: 0 };
    let updatedRoom = { ...room, players: updatedPlayers, score: updatedScore };

    if (Object.keys(updatedPlayers).length === 2 && room.status === "waiting") {
        updatedRoom = { ...updatedRoom, status: "playing", round: createRound(room.gameId, 1, room.hostId) };
    }

    await dbSet(paths.room(code), updatedRoom);
    storePlayerId(code, newId);
    registerPresence(code, newId);
    return { code, playerId: newId, room: updatedRoom };
}

// `action`s form beror på spelet (se respektive js/games/*.js) — t.ex.
// { type: "place", cell } eller { type: "move", from, to }.
export async function makeMove(code, action, playerId) {
    const { committed } = await dbTransact(paths.room(code), (current) => {
        if (!current || !current.round) return undefined;
        const players = current.players || {};
        const me = players[playerId];
        if (!me) return undefined;
        const otherId = Object.keys(players).find((id) => id !== playerId);
        const game = getGame(current.gameId);
        const updatedRound = game.applyAction(current.round, action, playerId, me.symbol, otherId);
        if (updatedRound === current.round) return undefined; // ogiltig handling, avbryt tyst
        return { ...current, round: updatedRound };
    });
    return committed;
}

// Anropas av BÅDA klienterna när de ser att en runda fått en vinnare.
// Transaktionen garanterar att bara den första som hinner fram faktiskt
// räknar poängen / startar nästa runda — den andra klientens försök
// avbryts tyst eftersom `round.scored` (eller ny rond/matchstatus) redan
// hunnit ändras.
export async function resolveRoundEnd(code) {
    const { committed } = await dbTransact(paths.room(code), (current) => {
        if (!current || !current.round || !current.round.winner) return undefined;
        if (current.round.scored) return undefined;

        const round = current.round;
        const score = { ...(current.score || {}) };
        const playerIds = Object.keys(current.players || {});
        if (round.winner !== "draw") {
            const winnerId = playerIds.find((id) => current.players[id].symbol === round.winner);
            if (winnerId) score[winnerId] = (score[winnerId] || 0) + (round.pointValue || 1);
        }

        // De flesta spel (luffarschack/Othello) spelas bäst av N ronder —
        // en majoritet av vinster avgör. Poängbaserade spel (backgammon,
        // med dubbleringstärning/gammon) spelas istället TILL N poäng.
        const game = getGame(current.gameId);
        const target = game.meta.matchFormat === "points" ? current.bestOf : winsNeeded(current.bestOf);
        const matchWinnerId = playerIds.find((id) => (score[id] || 0) >= target) || null;

        if (matchWinnerId) {
            return {
                ...current,
                score,
                round: { ...round, scored: true },
                status: "finished",
                matchWinner: matchWinnerId,
            };
        }

        const nextStarter = round.startingPlayer === current.hostId
            ? (playerIds.find((id) => id !== current.hostId) ?? current.hostId)
            : current.hostId;

        return { ...current, score, round: createRound(current.gameId, round.roundNumber + 1, nextStarter) };
    });
    return committed;
}

export async function startRematch(code) {
    const { committed } = await dbTransact(paths.room(code), (current) => {
        if (!current) return undefined;
        const playerIds = Object.keys(current.players || {});
        const score = {};
        playerIds.forEach((id) => { score[id] = 0; });
        return {
            ...current,
            score,
            status: "playing",
            matchWinner: null,
            round: createRound(current.gameId, 1, current.hostId),
        };
    });
    return committed;
}

export async function fetchRoom(code) {
    return dbGet(paths.room(code));
}

export function listenToRoom(code, callback) {
    return dbListen(paths.room(code), callback);
}
