# Boardgame

Bräddspel för mobilen — två spelare, varsin telefon, i realtid, med
flera spel att välja mellan. Webbaserat, byggt i vanilla
HTML/CSS/JavaScript (ES-moduler) med Firebase Realtime Database som
backend. Inga byggverktyg krävs.

## Spel

- **Luffarschack** — tre i rad, klassisk variant med flyttfas: varje
  spelare har bara 3 brickor. Så länge man har färre än 3 ute placerar
  man en ny bricka på valfri tom ruta. När alla 3 är utplacerade byter
  man istället till att FLYTTA en av sina brickor till valfri tom ruta
  varje tur (tryck på en egen bricka för att välja den, sedan på en
  tom ruta för att flytta dit) — brädet blir aldrig fullt, så partiet
  fortsätter tills någon får tre i rad.
- **Othello** (Reversi) — klassiska 8x8-reglerna. Lägg en bricka så att
  den fångar in en eller flera av motståndarens brickor i en rak linje
  (vågrätt, lodrätt eller diagonalt); de fångade brickorna vänds till
  din färg. Saknar man lagliga drag hoppar turen automatiskt över.
  Ronden slutar när ingen av spelarna kan dra mer — flest brickor
  vinner (oavgjort vid lika antal).
- **Backgammon** — fullständiga reglerna inklusive dubbleringstärning
  och gammon/backgammon-poäng (`round.pointValue`, visas som "(2/3
  poäng)" i statusraden). En medveten förenkling: appen kräver inte att
  man spelar tärningarna i den ordning som maximerar hur många som går
  att använda när läget är delvis blockerat — se kommentaren högst upp
  i `js/games/backgammon.js` för detaljer.
- **Sänka skepp** — klassiska reglerna på ett 10x10-hav med fem skepp
  (Hangarfartyg 5, Slagskepp 4, Kryssare 3, Ubåt 3, Jagare 2). Placera
  flottan i hemlighet (manuellt eller med "Slumpa"), skjut sedan
  omväxlande mot motståndarens hav — turen går alltid vidare efter ett
  skott oavsett träff eller miss. Den som sänker hela motståndarflottan
  först vinner ronden. Se "Kända begränsningar" nedan angående
  flottans synlighet i databasen.

Fler spel läggs till i `js/games/` — se "Lägga till ett nytt spel"
nedan.

## Så funkar det

1. Första gången appen öppnas väljer man sin **profil** — ett namn utan
   lösenord/PIN (se "Kända begränsningar"). Profilen är global (delas
   mellan alla rum) och används både som visningsnamn och som identitet
   i statistiken. Sparas i `localStorage` så man slipper välja om den
   vid varje besök — "byt profil" på hemskärmen för att välja en annan.
2. Spelare 1 väljer direkt ett spel på hemskärmen — inget "skapa
   rum"-mellansteg, inget "bäst av"-val. Rummet skapas direkt och man
   hamnar i en väntelobby med rumskoden synlig.
3. Spelare 2 ser DIREKT på sin egen hemskärm att t.ex. "Kristian
   startade Luffarschack", i en live-uppdaterad lista över öppna spel —
   och kan trycka **Gå med** där. Fungerar även utan att ha fått någon
   länk, så länge båda är på samma app samtidigt. Att skicka en inbjudan
   går fortfarande bra (dela-knappen i lobbyn) — mottagaren behöver bara
   öppna appens startsida, ingen kod krävs (fast en delad länk kan även
   förifylla koden i reservformuläret "Har du en rumskod?", ifall
   spelet av någon anledning inte hunnit synas i listan än).
4. När båda är anslutna startar första ronden med det valda spelets
   regler. Varje drag syncas i realtid till motståndarens telefon.
   Rondar spelas kontinuerligt utan något matchmål: när en rond får en
   vinnare loggas resultatet direkt till statistiken, men en NY rond
   startar först när BÅDA spelarna tryckt **Spela igen** — vem som
   helst kan istället lämna rummet när som helst.

## Statistik/leaderboard

Alla profiler kan se allas statistik (öppen leaderboard, inget privat
läge). Från hemskärmen → **Statistik**:

- **Topplista** (standardvy) — rankad efter flest vinster inom valt
  filter, med förluster/oavgjorda/vinstprocent.
- **Head-to-head** — välj en specifik motståndare i "Motståndare"-
  filtret för att istället se din egen historik mot just den profilen
  (vinster/förluster/oavgjort + senaste matcherna).
- Filtrera på **spel** (per spel eller alla samlat) och **tidsperiod**
  (idag/senaste veckan/månaden/året/totalt).

All aggregering sker client-side i `js/stats.js` (rena funktioner, inga
DOM-/Firebase-anrop) genom att läsa hela `luffarschack/statsLog` — ett
enkelt, litet dataset för en app som den här, så ingen databas-frågelogik
behövs.

## Köra spelet

Spelet **måste** köras via en webbserver (http:// eller https://) — inte
öppnas direkt som fil (file://), eftersom ES-moduler (import/export)
blockeras av webbläsaren annars.

### Snabbast: GitHub Pages
1. Gå till repots Settings → Pages.
2. Under "Build and deployment" → Source: välj "Deploy from a branch",
   branch `main`, mapp `/(root)`.
3. Spara. Efter någon minut är spelet live på
   `https://kkandenas.github.io/Boardgame/`

### Lokalt under utveckling
Valfri enkel statisk server, t.ex.:

    npx serve .

eller Pythons inbyggda server:

    python3 -m http.server 8080

Öppna sedan http://localhost:8080 (eller den port servern anger).

## Filstruktur

    index.html          Markup för samtliga skärmar (profil/hem/lobby/spel/statistik)
    style.css            All styling, mobilanpassad (touch-vänlig, safe-area)
    manifest.json         PWA-manifest ("Lägg till på hemskärmen")
    assets/
      bg-dogs.jpg           Bakgrundsbild på startsidorna (profil/hem/statistik) — se style.css .bg-start
    js/
      firebase.js         Firebase-init + generiska, transaktionssäkra DB-helpers (inkl. dbPush)
      profiles.js          Globala spelarprofiler (skapa/lista/spara i localStorage) + hämta statsLog
      rooms.js             Rum: skapa/gå med, öppna-rum-index (hemskärmens live-lista),
                            spelaridentitet, drag- och rondövergångar, rondslut + ömsesidig
                            "spela igen"-bekräftelse, statistikloggning — helt agnostisk om
                            VILKET spel som spelas
      stats.js              Ren aggregeringslogik för statistik/leaderboard (inga DOM-/Firebase-anrop)
      ui.js                All DOM-rendering, bygger brädet dynamiskt utifrån aktivt spel
      main.js              Skärmväxling, formulär, händelsebindning, Firebase-lyssnare
      games/
        registry.js          Register över alla spel (id → modul) — hit läggs nya spel
        shared.js            Hjälpfunktioner gemensamma för alla spel
        tictactoe.js         Luffarschack: regler + UI-hooks (rutnätsbräde)
        othello.js           Othello: regler + UI-hooks (rutnätsbräde)
        backgammon.js         Backgammon: regler + eget bräde (renderBoard)
        battleship.js          Sänka skepp: regler + eget bräde (placering + strid, renderBoard)

## Lägga till ett nytt spel

Varje fil i `js/games/` (utom `shared.js`/`registry.js`) exporterar
minst:

    meta              { id, label, description, boardClass }
    createBoard()      initial bräda för en ny runda
    applyAction(round, action, playerId, mySymbol, otherPlayerId)
                       ren funktion, returnerar en NY runda (eller
                       samma referens om handlingen var ogiltig).
                       Ansvarar själv för tur-/vinstlogik — inklusive ev.
                       automatiska passningar (othello.js) och ev.
                       round.pointValue för poängbaserade spel
                       (backgammon.js).
    symbolLabel(symbol)?     visningsnamn för X/O (t.ex. "Svart"/"Vitt")
    initialRoundState()?     extra fält på runde-nivå utöver standard
                             (backgammon: tärningar, dubbleringstärning)
    statusText(ctx)          statustext när det inte är vinst/väntan

Sedan väljer spelet EN av två sätt att rendera brädet:

1. **Rutnät** (tictactoe.js/othello.js) — sätt `meta.rows`/`cols`/
   `showGlyph` och exportera `cellInteractable(ctx)` +
   `onCellClick(ctx)`. ui.js bygger och sköter hela rutnätet automatiskt.
2. **Eget bräde** (backgammon.js) — exportera `renderBoard(container, ctx)`
   som bygger HELA sin DOM och binder sina egna klickhanterare direkt
   (`ctx.sendAction`/`ctx.setSelectedCell`). Använd när spelet inte är
   ett enkelt rutnät (annan form, extra kontroller som tärningar/kub).

Lägg sedan till modulen i `js/games/registry.js` och en knapp i
`index.html` (`#start-game-picker` på hemskärmen, `data-game-id`
matchar `meta.id`). Resten av appen (rum, matchning, poängräkning) är
redan generiskt.

## Teknik i korthet

- Delar Firebase-projekt med det andra spelet i denna organisation
  (samma klientkonfiguration — den är inte hemlig, säkerheten sitter i
  Realtime Database-reglerna). All data för det här spelet ligger
  isolerat under toppnoden `luffarschack/` i databasen: `rooms/` (rum),
  `profiles/` (spelarprofiler), `statsLog/` (append-only-logg över
  avslutade ronder, en post per `dbPush`) och `openRooms/` (lättviktigt
  index — bara {gameId, hostName, hostProfileId, createdAt} per rum i
  väntestatus, det hemskärmens live-lista lyssnar på istället för att
  behöva läsa/filtrera hela `rooms/`-trädet).
- Rumskoder och spelutgång (drag, poängräkning, rondövergångar) skrivs
  via Firebase-transaktioner på hela rum-noden. Det gör operationerna
  idempotenta: båda spelarnas klienter kan räkna ut och skriva samma
  resultat oberoende av varandra utan att krocka — ingen av klienterna
  behöver vara "auktoritativ värd". Rondslut (`finishRound`) och
  statistikloggning fungerar likadant: transaktionen garanterar att bara
  EN av de två klienterna faktiskt loggar en given rond, så ingen
  dubbelloggning kan ske även om båda klienterna märker rondslutet
  samtidigt.
- Spelarprofil sparas i `localStorage` (delas mellan alla rum på samma
  enhet), och rumsspecifik spelaridentitet (playerId) sparas separat per
  rumskod — en omladdning av sidan tappar alltså aldrig bort vare sig
  vem man är eller vilket parti man är mitt i.
- Frånkoppling hanteras med Firebase `onDisconnect` — lämnar spelaren
  (stängd flik, tappad uppkoppling) markeras de som frånkopplade och en
  banner visas för motståndaren.
- Alla interna filer laddas med ett `?v=N`-suffix som bumpas vid varje
  push, så att GitHub Pages/webbläsarens cache aldrig kan servera en
  äldre version av en enskild fil.

## Kända begränsningar (medvetet inte åtgärdade ännu)

- Firebase Security Rules är inte konfigurerade — rumsdatan är i
  praktiken läsbar/skrivbar av alla klienter. Bör låsas ner innan
  spelet används av folk du inte litar på. Detta är extra relevant för
  **Sänka skepp**: appen döljer bara motståndarens flotta i UI:t, den
  gömmer den inte på riktigt — en spelare som tittar i webbläsarens
  nätverksflik kan i teorin se var motståndarens skepp ligger.
- **Profiler har varken lösenord eller PIN** — ett medvetet val (matchar
  appens "inga konton"-filosofi) men det betyder att vem som helst med
  tillgång till appen kan välja en befintlig profil (t.ex. "Kristian")
  och spela/logga statistik i dess namn. Fungerar bra bland betrodda
  spelare, men lita inte på leaderboarden som bevis mot någon som vill
  fuska.
- Öppna rum är **globalt synliga för alla profiler** — precis som
  leaderboarden är detta ett medvetet val (ingen "vänner"-koppling
  finns), men det betyder att vem som helst med appen öppen kan se och
  gå med i vilket väntande rum som helst, inte bara de man själv blivit
  inbjuden till.
- Rum som blir övergivna UTAN att värden trycker "Avbryt" (t.ex. stängd
  flik/app) städas inte bort — varken själva rummet eller dess post i
  `openRooms/`, så de kan fortsätta synas som "väntar" i listan trots
  att ingen längre är där. `statsLog` växer också obegränsat (litet
  dataset för en hobbyapp, men inget städas bort automatiskt).
- Att gå med i ett rum är EN läsning + EN skrivning, ingen transaktion
  (se kommentaren i `rooms.js` joinRoom) — om två spelare skulle trycka
  "Gå med" på exakt samma rum i exakt samma millisekund kan den sista
  skrivningen skriva över den första. Mer sannolikt nu än tidigare
  eftersom öppna rum är synliga för fler samtidigt, men fortfarande ett
  medvetet accepterat, försumbart edge-case för en hobbyapp.
- Ingen chatt eller emote-funktion mellan spelarna ännu.
