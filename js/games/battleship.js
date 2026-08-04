// battleship.js — Sänka skepp, klassiska regler. 10x10-bräde, 5 skepp
// (5,4,3,2,3 rutor), ett skott per tur oavsett träff/miss.
//
// KÄND BEGRÄNSNING (samma kategori som redan står i README): Firebase
// Security Rules är inte konfigurerade, så BÅDA spelarnas flottor ligger
// tekniskt läsbara för båda klienterna i databasen — appen döljer bara
// motståndarens skepp i UI:t, den gömmer dem inte på riktigt. En spelare
// som tittar i webbläsarens nätverksflik kan i teorin se var
// motståndarens skepp ligger.
//
// Ren spellogik (inga sidoeffekter, inget DOM/Firebase) + renderBoard
// (eget bräde — två hav, inte det generiska rutnätet).

import { otherSymbolOf } from "./shared.js?v=26";

export const meta = {
    id: "battleship",
    label: "Sänka skepp",
    description: "Placera din flotta i hemlighet, sänk motståndarens skepp först.",
    boardClass: "board--battleship",
};

const GRID_SIZE = 10;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const SHIP_SPECS = [
    { name: "Hangarfartyg", length: 5 },
    { name: "Slagskepp", length: 4 },
    { name: "Kryssare", length: 3 },
    { name: "Ubåt", length: 3 },
    { name: "Jagare", length: 2 },
];

export function createBoard() {
    return {
        fleets: {
            X: { ships: null },
            O: { ships: null },
        },
        shots: { X: {}, O: {} },
    };
}

export function initialRoundState() {
    return { phase: "placing" };
}

function isStraightContiguous(cells) {
    if (cells.length === 1) return true;
    const rows = cells.map((c) => Math.floor(c / GRID_SIZE));
    const cols = cells.map((c) => c % GRID_SIZE);
    const sameRow = rows.every((r) => r === rows[0]);
    const sameCol = cols.every((c) => c === cols[0]);
    if (sameRow) {
        const sorted = [...cols].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
        return true;
    }
    if (sameCol) {
        const sorted = [...rows].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
        return true;
    }
    return false;
}

// Kontrollerar att en flotta har rätt antal skepp av rätt längder, alla
// inom brädet, inga överlapp, och att varje skepp är en rak sammanhängande
// linje. Skepp får ligga an mot varandra (klassiska regler kräver inget
// mellanrum).
export function validateFleet(ships) {
    if (!Array.isArray(ships) || ships.length !== SHIP_SPECS.length) return false;
    const gotLengths = ships.map((s) => (Array.isArray(s?.cells) ? s.cells.length : -1)).sort((a, b) => a - b);
    const wantLengths = SHIP_SPECS.map((s) => s.length).sort((a, b) => a - b);
    if (gotLengths.some((l, i) => l !== wantLengths[i])) return false;

    const seen = new Set();
    for (const ship of ships) {
        const cells = ship.cells;
        for (const c of cells) {
            if (!Number.isInteger(c) || c < 0 || c >= CELL_COUNT) return false;
            if (seen.has(c)) return false;
            seen.add(c);
        }
        if (!isStraightContiguous(cells)) return false;
    }
    return true;
}

function shipsWithHits(ships) {
    return ships.map((s, i) => ({ id: i, cells: s.cells.slice(), hits: s.cells.map(() => false) }));
}

// Riktiga Firebase Realtime Database lagrar ALDRIG ett tomt objekt heller
// — precis som en explicit `null` tas noden bort helt, och det kaskaderar:
// `{ships: null}` blir `{}` när `ships` strippas, och det TOMMA objektet
// försvinner i sin tur. Så `round.board.fleets`/`round.board.shots` (och
// till och med `round.board` självt, innan någon flotta placerats) kan bli
// `undefined` efter en tur-och-retur genom databasen, trots att de aldrig
// explicit sattes till null. Samma bugklass som tidigare bet i backgammon —
// därför läses ALLT härifrån via valfri kedjning (`?.`) med falsy-fallback,
// aldrig direkt indexering.
function fleetOf(board, symbol) {
    return board?.fleets?.[symbol] || null;
}

function shotsOf(board, symbol) {
    return board?.shots?.[symbol] || {};
}

export function applyAction(round, action, playerId, mySymbol, otherPlayerId) {
    if (!round || round.winner) return round;
    if (!action) return round;

    if (action.type === "place-fleet") {
        if (round.phase !== "placing") return round;
        if (fleetOf(round.board, mySymbol)?.ships) return round; // redan inskickad
        if (!validateFleet(action.ships)) return round;

        const fleets = { ...round.board?.fleets, [mySymbol]: { ships: shipsWithHits(action.ships) } };
        const board = { ...round.board, fleets };
        const bothReady = !!(fleets.X?.ships && fleets.O?.ships);
        return { ...round, board, phase: bothReady ? "battle" : "placing" };
    }

    if (action.type === "fire") {
        if (round.phase !== "battle" || round.turn !== playerId) return round;
        const cell = action.cell;
        if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return round;
        const myShotsExisting = shotsOf(round.board, mySymbol);
        if (myShotsExisting[cell] !== undefined) return round; // redan skjutit hit

        const otherSymbol = otherSymbolOf(mySymbol);
        const targetShips = fleetOf(round.board, otherSymbol)?.ships || [];
        let hitShipIndex = -1;
        let hitCellIndex = -1;
        targetShips.forEach((ship, si) => {
            const ci = ship.cells.indexOf(cell);
            if (ci !== -1) { hitShipIndex = si; hitCellIndex = ci; }
        });
        const isHit = hitShipIndex !== -1;

        const shots = { ...round.board?.shots, [mySymbol]: { ...myShotsExisting, [cell]: isHit ? "hit" : "miss" } };
        const newShips = isHit
            ? targetShips.map((ship, si) => {
                if (si !== hitShipIndex) return ship;
                const hits = ship.hits.slice();
                hits[hitCellIndex] = true;
                return { ...ship, hits };
            })
            : targetShips;
        const fleets = { ...round.board?.fleets, [otherSymbol]: { ships: newShips } };
        const board = { ...round.board, shots, fleets };

        const allSunk = newShips.every((s) => s.hits.every(Boolean));
        if (allSunk) {
            return { ...round, board, winner: mySymbol, winLine: null };
        }
        return { ...round, board, turn: otherPlayerId };
    }

    return round;
}

export function statusText({ round, myTurn, mySymbol }) {
    if (round.phase === "placing") {
        const mine = fleetOf(round.board, mySymbol)?.ships;
        return mine ? "Väntar på att motståndaren ska placera sin flotta…" : "Placera din flotta";
    }
    return myTurn ? "Din tur — skjut mot motståndarens hav" : "Motståndarens tur…";
}

// ============================================================
// Rendering — sänka skepp har ett eget bräde (två hav, olika
// interaktivitet i placerings- vs stridsfas), inte det generiska
// rutnätet ui.js annars bygger. Placeringens utkast (vilka rutor varje
// skepp preliminärt ligger på INNAN "Redo" trycks) är ren lokal
// UI-state som aldrig syncas — bara den slutgiltiga flottan skickas.
// ============================================================

let draft = { roundNumber: null, orientation: "h", ships: SHIP_SPECS.map(() => null), selected: 0 };

function resetDraft(roundNumber) {
    draft = { roundNumber, orientation: "h", ships: SHIP_SPECS.map(() => null), selected: 0 };
}

function firstUnplacedIndex(ships) {
    const idx = ships.findIndex((s) => !s);
    return idx === -1 ? ships.length - 1 : idx;
}

function computeCells(startCell, length, orientation) {
    const row = Math.floor(startCell / GRID_SIZE);
    const col = startCell % GRID_SIZE;
    const cells = [];
    for (let i = 0; i < length; i++) {
        const r = orientation === "v" ? row + i : row;
        const c = orientation === "h" ? col + i : col;
        if (r >= GRID_SIZE || c >= GRID_SIZE) return null; // utanför brädet
        cells.push(r * GRID_SIZE + c);
    }
    return cells;
}

function canPlace(ships, shipIndex, cells) {
    if (!cells) return false;
    const occupied = new Set();
    ships.forEach((s, i) => { if (s && i !== shipIndex) s.cells.forEach((c) => occupied.add(c)); });
    return cells.every((c) => !occupied.has(c));
}

function randomFleet() {
    for (let attempt = 0; attempt < 300; attempt++) {
        const occupied = new Set();
        const ships = [];
        let ok = true;
        for (const spec of SHIP_SPECS) {
            let placed = false;
            for (let tries = 0; tries < 200 && !placed; tries++) {
                const horizontal = Math.random() < 0.5;
                const row = Math.floor(Math.random() * GRID_SIZE);
                const col = Math.floor(Math.random() * GRID_SIZE);
                const cells = computeCells(row * GRID_SIZE + col, spec.length, horizontal ? "h" : "v");
                if (!cells || cells.some((c) => occupied.has(c))) continue;
                cells.forEach((c) => occupied.add(c));
                ships.push({ cells });
                placed = true;
            }
            if (!placed) { ok = false; break; }
        }
        if (ok) return ships;
    }
    return null; // ska i praktiken aldrig hända på ett 10x10-bräde med denna flotta
}

function buildGrid(container, extraClass) {
    const grid = document.createElement("div");
    grid.className = `ss-grid ${extraClass}`;
    return grid;
}

function renderPlacementUI(container, ctx) {
    const { sendAction } = ctx;
    const wrap = document.createElement("div");
    wrap.className = "ss-placement";

    const shipList = document.createElement("div");
    shipList.className = "ss-ship-list";
    SHIP_SPECS.forEach((spec, i) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "ss-ship-item";
        item.classList.toggle("placed", !!draft.ships[i]);
        item.classList.toggle("selected", draft.selected === i);
        item.textContent = `${spec.name} (${spec.length})`;
        item.addEventListener("click", () => {
            draft.ships[i] = null; // plocka upp för omplacering om den redan låg någonstans
            draft.selected = i;
            renderPlacementUI(container, ctx);
        });
        shipList.appendChild(item);
    });
    wrap.appendChild(shipList);

    const controls = document.createElement("div");
    controls.className = "ss-controls";

    const rotateBtn = document.createElement("button");
    rotateBtn.type = "button";
    rotateBtn.className = "btn btn-secondary bg-action-btn";
    rotateBtn.textContent = draft.orientation === "h" ? "Riktning: Vågrät" : "Riktning: Lodrät";
    rotateBtn.addEventListener("click", () => {
        draft.orientation = draft.orientation === "h" ? "v" : "h";
        renderPlacementUI(container, ctx);
    });
    controls.appendChild(rotateBtn);

    const randomBtn = document.createElement("button");
    randomBtn.type = "button";
    randomBtn.className = "btn btn-secondary bg-action-btn";
    randomBtn.textContent = "Slumpa";
    randomBtn.addEventListener("click", () => {
        const random = randomFleet();
        if (random) {
            draft.ships = random.map((s) => ({ cells: s.cells }));
            draft.selected = draft.ships.length - 1;
            renderPlacementUI(container, ctx);
        }
    });
    controls.appendChild(randomBtn);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn btn-ghost bg-action-btn";
    clearBtn.textContent = "Rensa";
    clearBtn.addEventListener("click", () => {
        draft.ships = SHIP_SPECS.map(() => null);
        draft.selected = 0;
        renderPlacementUI(container, ctx);
    });
    controls.appendChild(clearBtn);
    wrap.appendChild(controls);

    const allPlaced = draft.ships.every(Boolean);
    if (allPlaced) {
        const readyBtn = document.createElement("button");
        readyBtn.type = "button";
        readyBtn.className = "btn btn-primary ss-ready-btn";
        readyBtn.textContent = "Redo!";
        readyBtn.addEventListener("click", () => {
            sendAction({ type: "place-fleet", ships: draft.ships.map((s) => ({ cells: s.cells })) });
        });
        wrap.appendChild(readyBtn);
    } else {
        const hint = document.createElement("p");
        hint.className = "ss-hint-text";
        hint.textContent = "Välj en ruta på brädet för att placera det markerade skeppet.";
        wrap.appendChild(hint);
    }

    const grid = buildGrid(container, "ss-grid-own ss-grid-primary");
    const cellsOccupied = {};
    draft.ships.forEach((s, i) => { if (s) s.cells.forEach((c) => { cellsOccupied[c] = i; }); });

    for (let i = 0; i < CELL_COUNT; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ss-cell";
        if (cellsOccupied[i] !== undefined) btn.classList.add("ship");
        btn.addEventListener("click", () => {
            const shipIndex = draft.selected;
            if (draft.ships[shipIndex]) return; // redan placerad — välj den i listan för att flytta den
            const spec = SHIP_SPECS[shipIndex];
            const cells = computeCells(i, spec.length, draft.orientation);
            if (!canPlace(draft.ships, shipIndex, cells)) return;
            draft.ships[shipIndex] = { cells };
            draft.selected = firstUnplacedIndex(draft.ships);
            renderPlacementUI(container, ctx);
        });
        grid.appendChild(btn);
    }
    wrap.appendChild(grid);

    container.innerHTML = "";
    container.appendChild(wrap);
}

function renderWaitingBoard(container, ships) {
    const wrap = document.createElement("div");
    wrap.className = "ss-placement";

    const label = document.createElement("p");
    label.className = "ss-hint-text";
    label.textContent = "Din flotta är placerad. Väntar på motståndaren…";
    wrap.appendChild(label);

    const grid = buildGrid(container, "ss-grid-own ss-grid-primary");
    const occ = new Set();
    ships.forEach((s) => s.cells.forEach((c) => occ.add(c)));
    for (let i = 0; i < CELL_COUNT; i++) {
        const cell = document.createElement("div");
        cell.className = "ss-cell";
        if (occ.has(i)) cell.classList.add("ship");
        grid.appendChild(cell);
    }
    wrap.appendChild(grid);

    container.innerHTML = "";
    container.appendChild(wrap);
}

function renderBattleBoards(container, ctx) {
    const { round, mySymbol, myTurn, sendAction } = ctx;
    const otherSymbol = otherSymbolOf(mySymbol);
    const myShips = fleetOf(round.board, mySymbol)?.ships || [];
    const otherShips = fleetOf(round.board, otherSymbol)?.ships || [];
    const myShots = shotsOf(round.board, mySymbol);
    const otherShots = shotsOf(round.board, otherSymbol);

    const wrap = document.createElement("div");
    wrap.className = "ss-boards";

    const ownLabel = document.createElement("div");
    ownLabel.className = "ss-board-label";
    ownLabel.textContent = "Mitt hav";
    wrap.appendChild(ownLabel);

    const ownGrid = buildGrid(container, "ss-grid-own");
    const myShipCells = {};
    myShips.forEach((s, i) => s.cells.forEach((c) => { myShipCells[c] = i; }));
    for (let i = 0; i < CELL_COUNT; i++) {
        const cell = document.createElement("div");
        cell.className = "ss-cell";
        if (myShipCells[i] !== undefined) cell.classList.add("ship");
        const shot = otherShots[i];
        if (shot === "hit") {
            cell.classList.add("hit");
            const ship = myShips[myShipCells[i]];
            if (ship && ship.hits.every(Boolean)) cell.classList.add("sunk");
        } else if (shot === "miss") {
            cell.classList.add("miss");
        }
        ownGrid.appendChild(cell);
    }
    wrap.appendChild(ownGrid);

    const targetLabel = document.createElement("div");
    targetLabel.className = "ss-board-label";
    targetLabel.textContent = "Motståndarens hav";
    wrap.appendChild(targetLabel);

    const targetGrid = buildGrid(container, "ss-grid-target ss-grid-primary");
    for (let i = 0; i < CELL_COUNT; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ss-cell";
        const shot = myShots[i];
        if (shot === "hit") {
            btn.classList.add("hit");
            const ship = otherShips.find((s) => s.cells.includes(i));
            if (ship && ship.hits.every(Boolean)) btn.classList.add("sunk");
        } else if (shot === "miss") {
            btn.classList.add("miss");
        }
        const canFire = myTurn && shot === undefined && !round.winner;
        btn.disabled = !canFire;
        if (canFire) btn.addEventListener("click", () => sendAction({ type: "fire", cell: i }));
        targetGrid.appendChild(btn);
    }
    wrap.appendChild(targetGrid);

    container.innerHTML = "";
    container.appendChild(wrap);
}

export function renderBoard(container, ctx) {
    const { round, mySymbol } = ctx;
    if (draft.roundNumber !== round.roundNumber) resetDraft(round.roundNumber);

    const myShips = fleetOf(round.board, mySymbol)?.ships;

    if (round.phase === "placing" && !myShips) {
        renderPlacementUI(container, ctx);
        return;
    }
    if (round.phase === "placing" && myShips) {
        renderWaitingBoard(container, myShips);
        return;
    }
    renderBattleBoards(container, ctx);
}
