// hex.js — Hex, klassiska förbindelsespelet på ett rombiskt sexkantsbräde.
// 9x9 ("enkel" storlek, samma resonemang som Go: betydligt mer hanterbart
// på mobil än tävlingsstorleken 11x11 eller större), spelat med samma
// X/O-symboler som resten av appen (X = svart, börjar alltid; O = vit).
//
// Regler: Svart (X) bygger en obruten kedja av egna stenar mellan den
// ÖVRE och NEDRE kanten. Vitt (O) bygger en obruten kedja mellan den
// VÄNSTRA och HÖGRA kanten. Ren placering — ingen fångst, ingen flytt.
// Sexkantigt grannskap (6 riktningar, se HEX_DIRS), till skillnad från
// Go/Kvarns 4-vägs- respektive linje-grannskap.
//
// Ingen oavgjort-logik behövs: matematiskt (Hex-satsen, en topologisk
// konsekvens av att brädet självt är en sexkants-tesselering) MÅSTE ett
// helt fyllt Hex-bräde innehålla exakt en obruten kedja för EN av
// spelarna — och i praktiken avslutas ronden ändå alltid av en riktig
// vinstkontroll långt innan brädet blir fullt.
//
// Byt sida ("pie rule"/svap-regeln): Svart har ett STORT övertag i Hex
// eftersom första draget är extremt starkt oavsett var det läggs — som
// kompensation får Vitt, EN gång, som svar på Svarts allra första drag,
// välja att "byta sida" istället för att göra ett normalt drag. Bytet
// implementeras med det klassiska knepet att TRANSPONERA cellen (byt
// rad/kolumn) och ändra dess färg till Vitt, istället för att fysiskt
// spegla hela brädet — Hex-brädet är symmetriskt kring diagonalen (en
// spegling där rad byts mot kolumn byter samtidigt ut VILKA kanter som
// är "topp/botten" mot "vänster/höger"), så en transponerad, omfärgad
// sten ger Vitt en position som är EXAKT lika stark som Svarts
// ursprungliga drag var för Svart. Bara giltigt en enda gång, precis
// efter det allra första draget (round.board.stones har exakt 1 sten).

import { otherSymbolOf } from "./shared.js?v=38";

const SIZE = 9;
const CELL_COUNT = SIZE * SIZE;

export const meta = {
    id: "hex",
    label: "Hex",
    description: "Bygg en obruten kedja mellan dina två kanter innan motståndaren gör det mellan sina.",
    boardClass: "board--hex",
    rules: [
        "Svart (X) försöker bygga en obruten kedja av egna stenar mellan brädets ÖVRE och NEDRE kant. Vitt (O) försöker bygga en obruten kedja mellan den VÄNSTRA och HÖGRA kanten.",
        "Spelarna turas om att placera en sten på en ledig sexkant. Ingen fångst, ingen flytt — bara placering.",
        "En kedja räknas som obruten så länge varje sten i den gränsar direkt till nästa (sexkantigt grannskap — sex riktningar, inte fyra).",
        "Svart börjar alltid, vilket ger ett stort övertag i Hex — som kompensation får Vitt, EN gång, på sitt allra första drag, istället välja att \"byta sida\": ta över Svarts första sten (omvandlad till en lika stark position för Vitt) och fortsätta som om Vitt gjort det draget själv.",
        "Oavgjort kan aldrig uppstå i Hex — brädet räcker matematiskt alltid till exakt en obruten kedja för någon av spelarna.",
    ],
};

function idx(row, col) { return row * SIZE + col; }

// Sexkantigt grannskap för DEN HÄR koordinatkonventionen (varje rad
// förskjuten åt SAMMA håll relativt föregående, inte växelvis vänster/
// höger som i "brick"-hextilening) — se renderingssektionen längst ner
// för den geometriska härledningen av varför just de här 6 grannarna.
const HEX_DIRS = [
    [0, -1], [0, 1],
    [-1, 0], [-1, 1],
    [1, -1], [1, 0],
];

function neighborsOf(cell) {
    const row = Math.floor(cell / SIZE);
    const col = cell % SIZE;
    const result = [];
    for (const [dr, dc] of HEX_DIRS) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) result.push(idx(r, c));
    }
    return result;
}

export function createBoard() {
    return { stones: {} };
}

export function symbolLabel(symbol) {
    return symbol === "X" ? "Svart" : "Vitt";
}

// Flood-fill från spelarens EGEN startkant (X: hela rad 0, O: hela
// kolumn 0) över sammanhängande egna stenar (6-vägs grannskap) — true så
// fort en nådd sten ligger på målkanten (X: rad SIZE-1, O: kolumn SIZE-1).
function hasConnection(stones, symbol) {
    const alongRows = symbol === "X"; // X: rad -> rad (topp/botten). O: kolumn -> kolumn (vänster/höger).
    const start = [];
    for (let i = 0; i < SIZE; i++) {
        const cell = alongRows ? idx(0, i) : idx(i, 0);
        if (stones[cell] === symbol) start.push(cell);
    }
    const seen = new Set(start);
    const stack = [...start];
    while (stack.length) {
        const c = stack.pop();
        const row = Math.floor(c / SIZE);
        const col = c % SIZE;
        if (alongRows ? row === SIZE - 1 : col === SIZE - 1) return true;
        for (const n of neighborsOf(c)) {
            if (stones[n] === symbol && !seen.has(n)) { seen.add(n); stack.push(n); }
        }
    }
    return false;
}

// Svap-regeln är bara giltig som svar på motståndarens ALLRA FÖRSTA drag
// — dvs. brädet innehåller exakt EN sten, och den tillhör motståndaren
// (aldrig mig själv, det skulle bara kunna hända om jag av misstag redan
// hade svarat).
function isSwapLegal(stones, mySymbol) {
    const keys = Object.keys(stones);
    return keys.length === 1 && stones[keys[0]] === otherSymbolOf(mySymbol);
}

function finishPlacement(round, board, mySymbol, otherPlayerId, lastCell) {
    if (hasConnection(board.stones, mySymbol)) {
        return { ...round, board, winner: mySymbol, winLine: null, lastMove: { cells: [lastCell] } };
    }
    return { ...round, board, turn: otherPlayerId, lastMove: { cells: [lastCell] } };
}

export function applyAction(round, action, playerId, mySymbol, otherPlayerId) {
    if (!round || round.winner) return round;
    if (round.turn !== playerId) return round;
    if (!action) return round;

    const stones = round.board?.stones || {};

    if (action.type === "swap") {
        if (!isSwapLegal(stones, mySymbol)) return round;
        const onlyCell = Number(Object.keys(stones)[0]);
        const row = Math.floor(onlyCell / SIZE);
        const col = onlyCell % SIZE;
        const transposed = idx(col, row); // se filkommentaren: transponering + färgbyte = "byt sida"
        return finishPlacement(round, { stones: { [transposed]: mySymbol } }, mySymbol, otherPlayerId, transposed);
    }

    if (action.type === "place") {
        const cell = action.cell;
        if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return round;
        if (stones[cell]) return round; // upptagen sexkant
        return finishPlacement(round, { stones: { ...stones, [cell]: mySymbol } }, mySymbol, otherPlayerId, cell);
    }

    return round;
}

export function statusText({ round, myTurn, mySymbol }) {
    if (!myTurn) return "Motståndarens tur…";
    const stones = round.board?.stones || {};
    if (isSwapLegal(stones, mySymbol)) {
        return "Din tur — placera en sten, eller byt sida (ta över motståndarens första drag)";
    }
    return "Din tur — placera en sten";
}

// ============================================================
// Rendering — Hex bräde är en ROMB av hopkopplade sexkanter (varje rad
// förskjuten åt SAMMA håll relativt föregående, inte den vanliga
// "tegelsten"-hextileringen där varannan rad växlar riktning) — helt
// annorlunda geometri än Go/Kvarns punktbräden. Hela brädet ritas som EN
// SVG med varje sexkant som en <polygon> — exakt matematiskt placerad i
// SVG-koordinater (INTE procentuell CSS-positionering som Go/Kvarn) så
// att `viewBox` ensam sköter responsiviteten, utan att behöva räkna om
// hexagonernas exakta bredd/höjd-förhållande till procentsatser för
// hand. Se COL_SPACING/ROW_SHIFT/ROW_SPACING nedan för den geometriska
// härledningen (standardformler för "spetsig topp"-sexkantsrutnät med
// enhetlig radförskjutning, cirkumradie = 1).
// ============================================================

const HEX_R = 1;
const COL_SPACING = Math.sqrt(3) * HEX_R; // avstånd mellan grannars centrum i SAMMA rad
const ROW_SHIFT = COL_SPACING / 2;        // hur mycket varje rad förskjuts åt höger relativt föregående
const ROW_SPACING = 1.5 * HEX_R;          // avstånd mellan radernas centrum
const HALF_W = COL_SPACING / 2;           // sexkantens halva bredd (platt sida till platt sida)
const HALF_H = HEX_R;                     // sexkantens halva höjd (spets till spets)

function cellCenter(row, col) {
    return { x: col * COL_SPACING + row * ROW_SHIFT, y: row * ROW_SPACING };
}

// Brädets fulla utbredning i SVG-koordinater — rad 0/kolumn 0 sitter i
// origo, sista raden/kolumnen förskjuts både av sin egen kolumnposition
// OCH av alla föregående raders ackumulerade förskjutning.
const VIEW_MIN_X = -HALF_W;
const VIEW_MIN_Y = -HALF_H;
const VIEW_MAX_X = (SIZE - 1) * (COL_SPACING + ROW_SHIFT) + HALF_W;
const VIEW_MAX_Y = (SIZE - 1) * ROW_SPACING + HALF_H;
const VIEW_W = VIEW_MAX_X - VIEW_MIN_X;
const VIEW_H = VIEW_MAX_Y - VIEW_MIN_Y;

// Sex hörn för en "spetsig topp"-sexkant (spets rakt upp/ner, platta
// sidor vänster/höger) — start rakt upp (-90°) och var 60:e grad runt.
const HEX_ANGLES = [-90, -30, 30, 90, 150, 210].map((deg) => (deg * Math.PI) / 180);

function hexPoints(cx, cy, r) {
    return HEX_ANGLES.map((a) => `${(cx + r * Math.cos(a)).toFixed(4)},${(cy + r * Math.sin(a)).toFixed(4)}`).join(" ");
}

export function renderBoard(container, ctx) {
    const { round, mySymbol, myTurn, sendAction } = ctx;
    const stones = round.board?.stones || {};
    const canAct = myTurn && !round.winner;
    const canSwap = canAct && isSwapLegal(stones, mySymbol);
    const lastMoveSet = new Set(round.lastMove?.cells || []);

    const wrap = document.createElement("div");
    wrap.className = "hx-wrap";

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", `${VIEW_MIN_X} ${VIEW_MIN_Y} ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "hx-board");
    // Reserverar rätt höjd INNAN SVG:n hunnit layouta sig själv (annars
    // kan sidan hoppa till) — samma knep som battleship.js:s uppmätta
    // pixelbredd för lodräta skepp, fast här räknat rent matematiskt.
    svg.style.aspectRatio = `${VIEW_W} / ${VIEW_H}`;

    for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
            const cell = idx(row, col);
            const { x, y } = cellCenter(row, col);
            const poly = document.createElementNS(svgNs, "polygon");
            poly.setAttribute("points", hexPoints(x, y, HEX_R * 0.94)); // liten lucka mellan sexkanterna
            poly.dataset.cell = String(cell);

            const symbol = stones[cell];
            let cls = "hx-cell";
            if (symbol === "X") cls += " mark-x";
            else if (symbol === "O") cls += " mark-o";
            if (lastMoveSet.has(cell)) cls += " last-move";
            // Kantfärgning (vilken spelare som "äger" den kanten) syns bara
            // på fortfarande LEDIGA rutor — en placerad sten visar redan sin
            // egen färg, ytterligare en kantfärg där vore bara brus.
            if (!symbol) {
                if (row === 0 || row === SIZE - 1) cls += " hx-edge-x";
                if (col === 0 || col === SIZE - 1) cls += " hx-edge-o";
            }
            poly.setAttribute("class", cls);

            if (canAct && !symbol) {
                poly.classList.add("clickable");
                poly.addEventListener("click", () => sendAction({ type: "place", cell }));
            }
            svg.appendChild(poly);
        }
    }

    wrap.appendChild(svg);

    if (canSwap) {
        const swapBtn = document.createElement("button");
        swapBtn.type = "button";
        swapBtn.className = "btn btn-secondary hx-swap-btn";
        swapBtn.textContent = "Byt sida (ta över motståndarens första drag)";
        swapBtn.addEventListener("click", () => sendAction({ type: "swap" }));
        wrap.appendChild(swapBtn);
    }

    container.innerHTML = "";
    container.appendChild(wrap);
}
