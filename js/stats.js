// stats.js
// Ren beräkningslogik för statistik/leaderboard — inga DOM- eller
// Firebase-anrop här (testbart i isolering, precis som js/games/*.js).
// Läser hela statsLog och aggregerar client-side istället för att bygga
// några databas-frågor för det: Firebase Realtime Database har svagt
// frågestöd, och datamängden (en hobbyapp för ett par spelare) är för
// liten för att client-side-aggregering ska vara ett problem.

const TIMEFRAME_MS = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
};

function withinTimeframe(timestamp, timeframe, now) {
    if (!timeframe || timeframe === "all") return true;
    if (timeframe === "today") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return timestamp >= start.getTime();
    }
    const windowMs = TIMEFRAME_MS[timeframe];
    return windowMs ? timestamp >= now - windowMs : true;
}

export function filterEntries(entries, { gameId = "all", timeframe = "all" } = {}, now = Date.now()) {
    return (entries || []).filter((e) => {
        if (gameId && gameId !== "all" && e.gameId !== gameId) return false;
        return withinTimeframe(e.timestamp, timeframe, now);
    });
}

// Leaderboard: en rad per profil som förekommer i de filtrerade
// posterna, sorterad flest vinster -> bäst vinstprocent -> namn.
export function buildLeaderboard(entries) {
    const rows = new Map();
    function rowFor(profileId, name) {
        if (!rows.has(profileId)) rows.set(profileId, { profileId, name, played: 0, wins: 0, losses: 0, draws: 0 });
        return rows.get(profileId);
    }
    for (const entry of entries) {
        const symbols = Object.keys(entry.players || {});
        for (const sym of symbols) {
            const p = entry.players[sym];
            if (!p?.profileId) continue;
            const row = rowFor(p.profileId, p.name);
            row.played += 1;
            if (entry.winnerSymbol === "draw") row.draws += 1;
            else if (entry.winnerSymbol === sym) row.wins += 1;
            else row.losses += 1;
        }
    }
    return Array.from(rows.values())
        .map((r) => ({ ...r, winRate: r.played > 0 ? r.wins / r.played : 0 }))
        .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.name.localeCompare(b.name, "sv"));
}

// Head-to-head mellan `profileId` och `opponentId`, ur `profileId`s
// perspektiv (wins/losses räknas relativt den profilen).
export function buildHeadToHead(entries, profileId, opponentId) {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    const matches = [];
    for (const entry of entries) {
        const symbols = Object.keys(entry.players || {});
        const mySym = symbols.find((s) => entry.players[s]?.profileId === profileId);
        const oppSym = symbols.find((s) => entry.players[s]?.profileId === opponentId);
        if (!mySym || !oppSym || mySym === oppSym) continue;
        if (entry.winnerSymbol === "draw") draws += 1;
        else if (entry.winnerSymbol === mySym) wins += 1;
        else losses += 1;
        matches.push(entry);
    }
    matches.sort((a, b) => b.timestamp - a.timestamp);
    return { wins, losses, draws, played: wins + losses + draws, matches };
}
