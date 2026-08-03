// ui.js
// All DOM-rendering samlad här. Tar emot state (room-objektet från
// Firebase + vem jag är) och uppdaterar DOM:en. Inga Firebase-anrop i den
// här filen — bara läsning av data och uppdatering av skärmen.

import { boardToCells, winsNeeded, isPlacingPhase } from "./game.js?v=9";

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

export function renderGame(room, myPlayerId, selectedCell = null) {
    const me = room.players?.[myPlayerId];
    const oppId = getOpponentId(room, myPlayerId);
    const opp = oppId ? room.players[oppId] : null;
    const round = room.round;
    if (!me || !round) return;

    const myTurn = !round.winner && round.turn === myPlayerId && !!oppId;
    const placing = isPlacingPhase(round.board, me.symbol);

    const meChip = document.getElementById("chip-me");
    const oppChip = document.getElementById("chip-opp");
    document.getElementById("chip-me-name").textContent = playerLabel(me, "Du");
    document.getElementById("chip-me-symbol").textContent = me.symbol;
    document.getElementById("chip-me-score").textContent = room.score?.[myPlayerId] ?? 0;
    document.getElementById("chip-opp-name").textContent = opp ? playerLabel(opp, "Motståndare") : "Väntar…";
    document.getElementById("chip-opp-symbol").textContent = opp ? opp.symbol : "?";
    document.getElementById("chip-opp-score").textContent = oppId ? (room.score?.[oppId] ?? 0) : 0;

    meChip.classList.toggle("active-turn", !round.winner && round.turn === myPlayerId);
    oppChip.classList.toggle("active-turn", !round.winner && !!oppId && round.turn === oppId);

    const need = winsNeeded(room.bestOf);
    document.getElementById("round-indicator").textContent =
        `Runda ${round.roundNumber} · Bäst av ${room.bestOf} (${need} vinster avgör)`;

    const cells = boardToCells(round.board);
    const winSet = new Set(round.winLine || []);
    for (let i = 0; i < 9; i++) {
        const cellEl = document.getElementById(`cell-${i}`);
        cellEl.textContent = cells[i] || "";
        cellEl.classList.toggle("mark-x", cells[i] === "X");
        cellEl.classList.toggle("mark-o", cells[i] === "O");
        cellEl.classList.toggle("win", winSet.has(i));
        cellEl.classList.toggle("selected", myTurn && !placing && selectedCell === i);

        let canInteract;
        if (!myTurn) {
            canInteract = false;
        } else if (placing) {
            canInteract = !cells[i]; // valfri tom ruta
        } else {
            // Flyttfas: egna brickor går att välja, tomma rutor bara om
            // man redan valt en bricka att flytta.
            canInteract = cells[i] === me.symbol || (!cells[i] && selectedCell !== null);
        }
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
    } else if (myTurn) {
        if (placing) {
            statusEl.textContent = "Din tur — placera en bricka";
        } else if (selectedCell !== null) {
            statusEl.textContent = "Flytta till en tom ruta";
        } else {
            statusEl.textContent = "Din tur — välj en bricka att flytta";
        }
    } else {
        const oppPlacing = opp && isPlacingPhase(round.board, opp.symbol);
        statusEl.textContent = oppPlacing ? "Motståndarens tur — placerar…" : "Motståndarens tur — flyttar…";
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
