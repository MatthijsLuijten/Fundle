# Nieuwe spelmodus: Steden (verzegeld bod, uitslag om 18:00)

## Wat

Naast de dagelijkse puzzel is er nu een tweede modus: **Steden**. Je kiest één van 10 Nederlandse steden, ziet één woning die daar te koop staat, en plaatst één verzegeld bod. Je krijgt níet meteen te horen of je het huis hebt - dat zie je pas na de sluiting om 18:00 (Europe/Amsterdam), als de vraagprijs wordt onthuld. Iedereen die die dag op dezelfde stad speelt, biedt op dezelfde woning en speelt zo tegen elkaar.

Winnen = het dichtst bij de vraagprijs zitten (net als daily, maar hier telt de afstand tot de prijs, niet het hoogste bod). De winnaar is het enige dichtstbijzijnde bod; bij een gelijke afstand wint het bod dat het eerst is geplaatst. Er zijn (nog) geen accounts, dus we tonen niet wíe gewonnen heeft - je ziet alleen of jij zelf het dichtst zat, plus je plek in het veld.

De dagelijkse modus blijft volledig ongewijzigd. Steden is een aparte, op zichzelf staande laag (eigen route, eigen datalaag, eigen tabellen).

## Hoe het werkt

De belangrijkste eis: in tegenstelling tot daily mag het antwoord niet vooraf in de pagina staan, want het is een competitieve modus met uitgestelde uitslag. Daarom:

- Het antwoord (`answer_token`) staat wél in `city_puzzles`, maar anon mag die kolom **niet** lezen (column-level grants). Je kunt de prijs dus niet uit de netwerk-tab plukken vóór 18:00.
- Biedingen gaan server-side via een afgeschermde RPC (`submit_city_bid`) en worden opgeslagen in `city_bids`. De browser heeft geen directe lees/schrijf-toegang tot die tabel.
- De uitslag komt via `reveal_city`: vóór `closes_at` geeft die alleen `{open: true}` terug (geen prijs); ná `closes_at` de prijs plus jouw uitslag (afstand, plek, of je het winnende bod had, aantal bieders).
- Misbruikbescherming zit direct in de RPC's ingebakken (één bod per sessie - eerste bod telt, ruwe per-IP daglimiet, alleen de puzzel van vandaag, alleen vóór sluiting). Dit staat los van migratie 0002, die niet op deze branch zit.

Eén gedeelde woning per (stad, dag). Bieden staat open van 00:00 tot `closes_at` (standaard 18:00 Amsterdam, per rij opgeslagen zodat alle reveal-logica op de timestamp werkt en niet op een vaste planning).

## Backend

- `supabase/migrations/0004_city_mode.sql` - tabellen `city_puzzles` + `city_bids`, RLS, column-grants (antwoord verborgen), en de RPC's `submit_city_bid` / `reveal_city` / `city_deobfuscate`. Ook toegevoegd aan `supabase/schema.sql` voor een schone setup.
- `supabase/migrations/0005_city_puzzle_cron.sql` - pg_cron trigger die de build om Amsterdam-middernacht start (spiegelt 0001, gebruikt dezelfde Vault-secret).
- `apps/api/app/services/city_puzzle_builder.py` - stad-register (10 steden) + Funda-selectie per stad (`search(location=...)`; Den Haag gebruikt de slug `den-haag`). Hergebruikt de validatie/detail-helpers van de daily builder.
- `scripts/build_city_puzzles.py` - bouwt en publiceert per stad naar Supabase, idempotent per (stad, dag). `--dry-run`, `--city`, `--date`, `--force`.
- `.github/workflows/build-city-puzzles.yml` - dagelijkse build (pg_cron primair, GitHub-cron als vangnet), zelfde patroon als de daily workflow.

## Frontend

- Route `apps/web/app/city/page.tsx` + `components/CityGame.tsx` (stadskeuze → bod → wachten → uitslag). Een kleine modus-switch (Dagelijks / Steden) staat in de gedeelde header.
- Datalaag `apps/web/lib/city*.ts`: `cityApi` kiest tussen Supabase (`citySupabase`) en de offline mock (`cityMock`). Pure scoringslogica in `cityEngine.ts` (gespiegeld aan de SQL). Herbruikt `PhotoGallery`, `HintPanel`, `GuessInput`.
- "Nieuw"-badge op de Steden-tab tot je de modus voor het eerst opent (localStorage `fundle_city_seen`).
- Delen op het uitslagscherm: de deeltekst stapelt je daily-resultaat van vandaag (bovenaan, als je het speelde) op je stadsplek. Werkt ook als je daily niet speelde. Daily slaat zijn resultaat op in localStorage (`saveDailyResult`) zodat de stad-pagina het kan meenemen.

## Zo test je het lokaal (dev mode)

De hele modus is offline speelbaar, zonder live Funda en zonder Supabase.

1. Zet in `fundle.config.env` de regel `CITY_LOCAL=1` (of `NEXT_PUBLIC_CITY_LOCAL=1` in `apps/web/.env.local`).
2. Start met `npm run dev` en ga naar `http://localhost:3000/city`.
3. Kies een stad en plaats een bod. Je ziet nu het "bod geplaatst, kom terug na 18:00"-scherm.
4. Om de uitslag meteen te zien (zonder tot 18:00 te wachten): voeg een reveal-parameter aan de URL toe en kies (opnieuw) de stad. `?reveal=1` toont de uitslag op basis van je eigen bod (bied dus eerst), `?reveal=win` forceert het winnaarsscherm en `?reveal=lose` het verliesscherm (beide zonder dat je hoeft te bieden of de prijs hoeft te weten). Bijv. `http://localhost:3000/city?reveal=win`.

De offline modus gebruikt fixtures uit `apps/web/lib/__fixtures__/cityPuzzles.json` - dit zijn **echte Funda-woningen** (echte foto's, hints en prijzen), zodat je met realistische data test. Regenereren als ze verouderd zijn (woningen worden verkocht): `python scripts/gen_city_fixtures.py`. Community-writes staan in dev sowieso uit.

Live Funda-selectie los controleren (één netwerk-call, geen Supabase): `python scripts/build_city_puzzles.py --dry-run --city almere`.

## Tests

- `cd apps/web && npm test` - 43 tests, incl. de pure scoringslogica, de volledige offline flow (serve → bod → uitslag, eerste-bod-wint, exact bod wint, geforceerde win/lose reveal) en de gecombineerde deeltekst.
- `cd apps/api && uv run pytest && uv run ruff check app tests` - 24 tests groen.
- `apps/web`: `npx tsc --noEmit` en `npm run build` slagen; beide routes (`/` en `/city`) compileren.

## Deploy-stappen (code vandaag, live morgen)

De Steden-tab en `/city` staan achter `NEXT_PUBLIC_CITY_ENABLED`. Zonder die vlag is de modus onzichtbaar (tab weg, `/city` geeft 404), dus je kunt vandaag mergen en deployen zonder dat gebruikers iets zien. De dagelijkse puzzel wordt nergens geraakt: city-modus heeft eigen tabellen, script en workflow.

Vandaag:
1. Merge de PR / deploy naar Vercel. `NEXT_PUBLIC_CITY_ENABLED` staat niet aan, dus gebruikers zien niets nieuws en de daily werkt gewoon door.
2. Draai `0004_city_mode.sql` en `0005_city_puzzle_cron.sql` op Supabase (SQL editor of CLI). Dit maakt alleen nieuwe tabellen/functies aan; niets aan de daily verandert. `CITY_LOCAL` laat je weg in productie (echte Supabase-backend).
3. De Vault-secret `github_pat_build_puzzle` bestaat al voor de daily cron; niets nieuws nodig.

Vannacht bouwt de pg_cron uit 0005 de stadspuzzels om Amsterdam-middernacht (of het GitHub-vangnet 's ochtends).

Morgen:
4. Check dat `city_puzzles` 10 rijen voor vandaag heeft (REST of SQL). Eventueel eerst zelf testen via een preview-deploy met de vlag aan.
5. Zet `NEXT_PUBLIC_CITY_ENABLED=1` in Vercel en redeploy. De Steden-tab verschijnt en werkt meteen.
