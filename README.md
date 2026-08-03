# Luffarschack

Luffarschack (tre i rad) för mobilen — två spelare, varsin telefon, i
realtid. Webbaserat, byggt i vanilla HTML/CSS/JavaScript (ES-moduler) med
Firebase Realtime Database som backend. Inga byggverktyg krävs.

## Så funkar det

1. Spelare 1 trycker **Skapa rum**, väljer bäst av 3/5/7 och får en
   4-teckens rumskod (och en delningslänk).
2. Spelare 2 trycker **Gå med i rum** och matar in koden — eller öppnar
   delningslänken direkt, då fylls koden i automatiskt.
3. När båda är anslutna startar första ronden. Varje spelare har bara
   3 brickor: så länge man har färre än 3 ute placerar man en ny bricka
   på valfri tom ruta. När alla 3 är utplacerade byter man istället till
   att FLYTTA en av sina brickor till valfri tom ruta varje tur (tryck
   på en egen bricka för att välja den, sedan på en tom ruta för att
   flytta dit) — brädet blir aldrig fullt, så partiet fortsätter tills
   någon får tre i rad. Varje drag syncas i realtid till motståndarens
   telefon.
4. Efter varje runda uppdateras ställningen och en ny runda startar
   automatiskt (den som inte började föregående runda börjar nästa).
5. När någon når tillräckligt många vinster (t.ex. 2 av 3) visas
   matchresultatet, med möjlighet till revansch i samma rum.

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
      game.js              Ren spellogik: placerings-/flyttfas, vinstdetektering, rondhantering
      rooms.js             Rum: skapa/gå med, spelaridentitet, drag- och rond-/matchövergångar
      ui.js                All DOM-rendering
      main.js              Skärmväxling, formulär, händelsebindning, Firebase-lyssnare

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

## Kända begränsningar (medvetet inte åtgärdade ännu)

- Firebase Security Rules är inte konfigurerade — rumsdatan är i
  praktiken läsbar/skrivbar av alla klienter. Bör låsas ner innan
  spelet används av folk du inte litar på.
- Gamla/övergivna rum städas inte bort ur databasen.
- Ingen chatt eller emote-funktion mellan spelarna ännu.
