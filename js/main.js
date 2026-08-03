// main.js
// Startpunkt: kopplar ihop skärmar, formulär och Firebase-lyssnaren.
// Håller det lilla state:t appen behöver (vilket rum/spelare jag är).

import {
    createRoom, joinRoom, makeMove, resolveRoundEnd, startRematch,
    forgetRoom, listenToRoom, normalizeCode,
} from "./rooms.js";
import { showScreen, renderLobby, renderGame, renderMatchOver, setError } from "./ui.js";

let currentCode = null;
let myPlayerId = null;
let unsubscribe = null;
let scheduledRoundNumber = null;
let roundEndTimer = null;

function resetRoundEndTimer() {
    if (roundEndTimer) {
        clearTimeout(roundEndTimer);
        roundEndTimer = null;
    }
}

function leaveRoomState() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    resetRoundEndTimer();
    scheduledRoundNumber = null;
    if (currentCode) forgetRoom(currentCode);
    currentCode = null;
    myPlayerId = null;
}

function subscribe(code) {
    if (unsubscribe) unsubscribe();
    unsubscribe = listenToRoom(code, (room) => onRoomUpdate(room));
}

function onRoomUpdate(room) {
    if (!room || room.claiming) return; // rum borttaget eller mitt i skapandet

    if (room.status === "waiting") {
        showScreen("lobby");
        renderLobby(room, currentCode);
        return;
    }

    if (room.status === "playing") {
        showScreen("game");
        renderGame(room, myPlayerId);

        const round = room.round;
        if (round?.winner && !round.scored && scheduledRoundNumber !== round.roundNumber) {
            scheduledRoundNumber = round.roundNumber;
            resetRoundEndTimer();
            roundEndTimer = setTimeout(() => {
                resolveRoundEnd(currentCode).catch(() => { /* motparten hann redan lösa det */ });
            }, 1500);
        }
        return;
    }

    if (room.status === "finished") {
        resetRoundEndTimer();
        showScreen("match-over");
        renderMatchOver(room, myPlayerId);
    }
}

function buildShareUrl(code) {
    const url = new URL(location.href);
    url.search = `?code=${code}`;
    return url.toString();
}

// --- Startskärm ---
document.getElementById("btn-show-create").addEventListener("click", () => {
    setError("create", "");
    showScreen("create");
});
document.getElementById("btn-show-join").addEventListener("click", () => {
    setError("join", "");
    showScreen("join");
});
document.getElementById("btn-create-back").addEventListener("click", () => showScreen("home"));
document.getElementById("btn-join-back").addEventListener("click", () => showScreen("home"));

// --- Skapa rum ---
document.getElementById("form-create").addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("create", "");
    const name = document.getElementById("create-name").value.trim().slice(0, 20);
    const bestOf = Number(document.querySelector('input[name="bestOf"]:checked').value);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
        const { code, playerId } = await createRoom(bestOf, name);
        currentCode = code;
        myPlayerId = playerId;
        subscribe(code);
        showScreen("lobby");
        setupLobbyLinks(code);
    } catch (err) {
        setError("create", err.message || "Kunde inte skapa rummet. Försök igen.");
    } finally {
        submitBtn.disabled = false;
    }
});

// --- Gå med i rum ---
document.getElementById("form-join").addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("join", "");
    const name = document.getElementById("join-name").value.trim().slice(0, 20);
    const code = document.getElementById("join-code").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
        const result = await joinRoom(code, name);
        currentCode = result.code;
        myPlayerId = result.playerId;
        subscribe(result.code);
        showScreen("lobby");
        setupLobbyLinks(result.code);
    } catch (err) {
        setError("join", err.message || "Kunde inte gå med i rummet.");
    } finally {
        submitBtn.disabled = false;
    }
});

document.getElementById("join-code").addEventListener("input", (e) => {
    e.target.value = normalizeCode(e.target.value);
});

// --- Lobby ---
function setupLobbyLinks(code) {
    const url = buildShareUrl(code);
    const shareBtn = document.getElementById("btn-share-link");
    if (navigator.share) {
        shareBtn.classList.remove("hidden");
        shareBtn.onclick = () => {
            navigator.share({ title: "Luffarschack", text: `Spela luffarschack mot mig! Rumskod: ${code}`, url }).catch(() => {});
        };
    } else {
        shareBtn.classList.add("hidden");
    }
    document.getElementById("btn-copy-link").onclick = async () => {
        try {
            await navigator.clipboard.writeText(url);
            const btn = document.getElementById("btn-copy-link");
            const original = btn.textContent;
            btn.textContent = "Kopierad!";
            setTimeout(() => { btn.textContent = original; }, 1500);
        } catch {
            window.prompt("Kopiera länken:", url);
        }
    };
}

document.getElementById("btn-lobby-cancel").addEventListener("click", () => {
    leaveRoomState();
    showScreen("home");
});

// --- Spelbrädet ---
for (let i = 0; i < 9; i++) {
    document.getElementById(`cell-${i}`).addEventListener("click", () => {
        if (!currentCode || !myPlayerId) return;
        makeMove(currentCode, i, myPlayerId).catch(() => { /* ogiltigt drag, ignorera */ });
    });
}

document.getElementById("btn-leave-game").addEventListener("click", () => {
    if (!window.confirm("Lämna spelet?")) return;
    leaveRoomState();
    showScreen("home");
});

// --- Matchen är slut ---
document.getElementById("btn-rematch").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
        await startRematch(currentCode);
    } finally {
        e.target.disabled = false;
    }
});

document.getElementById("btn-home").addEventListener("click", () => {
    leaveRoomState();
    showScreen("home");
});

// --- Start: läs ev. ?code= i länken och hoppa direkt till "gå med" ---
(function init() {
    const params = new URLSearchParams(location.search);
    const codeFromLink = normalizeCode(params.get("code") || "");
    if (codeFromLink) {
        document.getElementById("join-code").value = codeFromLink;
        showScreen("join");
    } else {
        showScreen("home");
    }
})();
