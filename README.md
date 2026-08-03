# Luffarschack

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
  och gammon/backgammon-poäng. Spelas TILL ett poängmål (samma
  3/5/7-val som "bäst av" ovan, men här tolkat som poänggräns) istället
  för bäst-av-N-ronder. En medveten förenkling: appen kräver inte att
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

1. Spelare 1 trycker **Skapa rum**, väljer spel och bäst av 3/5/7, och
   får en 4-teckens rumskod (och en delningslänk).
2. Spelare 2 trycker **Gå med i rum** och matar in koden — eller öppnar
   delningslänken direkt, då fylls koden i automatiskt.
3. När båda är anslutna startar första ronden med det valda spelets
   regler. Varje drag syncas i realtid till motståndarens telefon.
4. Efter varje runda uppdateras ställningen och en ny runda startar
   automatiskt (den som inte började föregående runda börjar nästa).
5. När någon når tillräckligt många vinster (t.ex. 2 av 3) visas
   matchresultatet, med möjlighet till revansch i samma rum (samma
   spel som valdes från början).

## Köra spelet

Spelet **måste** köras via en webbserver (http:// eller https://) — inte
öppnas direkt som fil (file://), eftersom ES-moduler (import/export)
blockeras av webbläsaren annars.

### Snabbast: GitHub Pages
1. Gå till repots Settings → Pages.
2. Under "Build and deployment" → Source: välj "Deploy from a branch",
   branch `main`, mapp `/(root)`.
3. Spara. Efter någon minut är spelet live på
   `https://kkandenas.github.io/luffarschack/`

### Lokalt under utveckling
Valfri enkel statisk server, t.ex.:

    npx serve .

eller Pythons inbyggda server:

    python3 -m http.server 8080

Öppna sedan http://localhost:8080 (eller den port servern anger).

## Filstruktur

    index.html          Markup för samtliga skärmar (hem/skapa/gå med/lobby/spel/matchslut)
    style.css            All styling, mobilanpassad (touch-vänlig, safe-area)
    manifest.json         PWA-manifest ("Lägg till på hemskärmen")
    js/
      firebase.js         Firebase-init + generiska, transaktionssäkra DB-helpers
      rooms.js             Rum: skapa/gå med, spelaridentitet, drag- och rond-/matchövergångar
                            — helt agnostisk om VILKET spel som spelas
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

    meta              { id, label, description, boardClass, matchFormat? }
                       matchFormat: "games" (bäst av N-vinster, default)
                       eller "points" (spela TILL N poäng — se backgammon)
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

Lägg sedan till modulen i `js/games/registry.js` och en radioknapp i
`index.html` (fieldset "Spel" i #screen-create). Resten av appen
(rum, matchning, poängräkning) är redan generiskt.

## Teknik i korthet

- Delar Firebase-projekt med det andra spelet i denna organisation
  (samma klientkonfiguration — den är inte hemlig, säkerheten sitter i
  Realtime Database-reglerna). All data för det här spelet ligger
  isolerat under toppnoden `luffarschack/` i databasen.
- Rumskoder och spelutgång (drag, poängräkning, rondövergångar) skrivs
  via Firebase-transaktioner på hela rum-noden. Det gör operationerna
  idempotenta: båda spelarnas klienter kan räkna ut och skriva samma
  resultat oberoende av varandra utan att krocka — ingen av klienterna
  behöver vara "auktoritativ värd".
- Spelaridentitet sparas i `localStorage` per rumskod, så en
  omladdning av sidan inte tappar bort vem man är i pågående parti.
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
- Gamla/övergivna rum städas inte bort ur databasen.
- Ingen chatt eller emote-funktion mellan spelarna ännu.
