// ui.js
// All DOM-rendering samlad här. Tar emot state (room-objektet från
// Firebase + vem jag är) och uppdaterar DOM:en. Inga Firebase-anrop i den
// här filen. Vet ingenting om enskilda spels regler — allt sådant kommer
// från den aktuella spelmodulen (js/games/registry.js) via room.gameId.

import { boardToCells, winsNeeded } from "./games/shared.js?v=11";
import { getGame } from "./games/registry.js?v=11";

const screens = {
    home: document.getElementById("screen-home"),
    create: document.getElementById("screen-create"),
    join: document.getElementById("screen-join"),
    lobby: document.getElementById("screen-lobby"),
    game: document.getElementById("screen-game"),
    "match-over": document.getElementById("screen-match-over"),
};

export function showScreen(name) {
    for (const key in screens) {
        screens[key].classList.toggle("active", key === name);
    }
}

function playerLabel(player, fallback) {
    if (!player) return fallback;
    return player.name || fallback;
}

export function getOpponentId(room, myPlayerId) {
    const ids = Object.keys(room.players || {});
    return ids.find((id) => id !== myPlayerId) || null;
}

export function renderLobby(room, code) {
    document.getElementById("lobby-code").textContent = code;
    const playerCount = Object.keys(room.players || {}).length;
    const statusEl = document.getElementById("lobby-status");
    statusEl.textContent = playerCount >= 2
        ? "Motståndare hittad! Startar…"
        : "Väntar på motståndare…";
}

// Brädet byggs om i DOM:en bara när spelet (och därmed dimensionerna)
// faktiskt ändras — annars återanvänds samma knappar mellan renderingar.
let builtBoardKey = null;

function ensureBoardGrid(game) {
    const key = `${game.meta.id}:${game.meta.rows}x${game.meta.cols}`;
    if (builtBoardKey === key) return;
    builtBoardKey = key;

    const boardEl = document.getElementById("board");
    boardEl.className = `board ${game.meta.boardClass}`;
    boardEl.style.gridTemplateColumns = `repeat(${game.meta.cols}, 1fr)`;
    boardEl.innerHTML = "";

    const count = game.meta.rows * game.meta.cols;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.id = `cell-${i}`;
        frag.appendChild(btn);
    }
    boardEl.appendChild(frag);
}

export function renderGame(room, myPlayerId, selectedCell = null) {
    const me = room.players?.[myPlayerId];
    const oppId = getOpponentId(room, myPlayerId);
    const opp = oppId ? room.players[oppId] : null;
    const round = room.round;
    if (!me || !round) return;

    const game = getGame(room.gameId);
    ensureBoardGrid(game);

    const myTurn = !round.winner && round.turn === myPlayerId && !!oppId;

    const meChip = document.getElementById("chip-me");
    const oppChip = document.getElementById("chip-opp");
    const symbolLabel = game.symbolLabel || ((s) => s);
    document.getElementById("chip-me-name").textContent = playerLabel(me, "Du");
    document.getElementById("chip-me-symbol").textContent = symbolLabel(me.symbol);
    document.getElementById("chip-me-score").textContent = room.score?.[myPlayerId] ?? 0;
    document.getElementById("chip-opp-name").textContent = opp ? playerLabel(opp, "Motståndare") : "Väntar…";
    document.getElementById("chip-opp-symbol").textContent = opp ? symbolLabel(opp.symbol) : "?";
    document.getElementById("chip-opp-score").textContent = oppId ? (room.score?.[oppId] ?? 0) : 0;

    meChip.classList.toggle("active-turn", !round.winner && round.turn === myPlayerId);
    oppChip.classList.toggle("active-turn", !round.winner && !!oppId && round.turn === oppId);

    const need = winsNeeded(room.bestOf);
    document.getElementById("round-indicator").textContent =
        `${game.meta.label} · Runda ${round.roundNumber} · Bäst av ${room.bestOf} (${need} vinster avgör)`;

    const cellCount = game.meta.rows * game.meta.cols;
    const cells = boardToCells(round.board, cellCount);
    const winSet = new Set(round.winLine || []);
    for (let i = 0; i < cellCount; i++) {
        const cellEl = document.getElementById(`cell-${i}`);
        cellEl.textContent = game.meta.showGlyph ? (cells[i] || "") : "";
        cellEl.classList.toggle("mark-x", cells[i] === "X");
        cellEl.classList.toggle("mark-o", cells[i] === "O");
        cellEl.classList.toggle("win", winSet.has(i));
        cellEl.classList.toggle("selected", selectedCell === i);

        const canInteract = game.cellInteractable({
            round, board: round.board, cellIndex: i, mySymbol: me.symbol, myTurn, selectedCell,
        });
        cellEl.classList.toggle("hint", canInteract && !cells[i]);
        cellEl.disabled = !canInteract;
    }

    const statusEl = document.getElementById("game-status");
    const banner = document.getElementById("connection-banner");
    if (!oppId) {
        statusEl.textContent = "Väntar på motståndare…";
        banner.classList.add("hidden");
    } else if (opp && opp.connected === false) {
        banner.textContent = "Motståndaren har tappat anslutningen…";
        banner.classList.remove("hidden");
    } else {
        banner.classList.add("hidden");
    }

    if (round.winner === "draw") {
        statusEl.textContent = "Oavgjort! Nästa runda börjar strax…";
    } else if (round.winner === me.symbol) {
        statusEl.textContent = "Du vann ronden! 🎉";
    } else if (round.winner) {
        statusEl.textContent = "Motståndaren vann ronden.";
    } else if (!oppId) {
        // hanteras redan ovan (väntar på motståndare)
    } else {
        statusEl.textContent = game.statusText({
            round, board: round.board, myTurn, mySymbol: me.symbol, selectedCell,
        });
    }
}

export function renderMatchOver(room, myPlayerId) {
    const me = room.players?.[myPlayerId];
    const oppId = getOpponentId(room, myPlayerId);
    const opp = oppId ? room.players[oppId] : null;
    const iWon = room.matchWinner === myPlayerId;

    document.getElementById("match-over-title").textContent = iWon
        ? "🏆 Du vann matchen!"
        : `🏆 ${playerLabel(opp, "Motståndaren")} vann matchen`;

    const myScore = room.score?.[myPlayerId] ?? 0;
    const oppScore = oppId ? (room.score?.[oppId] ?? 0) : 0;
    document.getElementById("match-over-score").textContent =
        `${playerLabel(me, "Du")} ${myScore} – ${oppScore} ${playerLabel(opp, "Motståndaren")}`;
}

export function setError(screenName, message) {
    const el = document.getElementById(`${screenName}-error`);
    if (el) el.textContent = message || "";
}
