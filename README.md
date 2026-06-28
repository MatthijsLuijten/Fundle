<p align="center">
  <img src="apps/web/public/logo.png" alt="Fundle" width="360">
</p>

<p align="center">
  <strong>Guess the Funda asking price in 5 tries.</strong><br>
  Each wrong guess unlocks more hints — area, energy label, photos, and more.
</p>

---

## Stack

- **Frontend:** Next.js (`apps/web`)
- **Backend:** FastAPI + pyfunda (`apps/api`)
- **Database:** SQLite (local dev), PostgreSQL (production via Neon)

## Daily use

From the **project root**, one command starts the API and web together (no venv activation, no second terminal):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API runs on [http://localhost:8000](http://localhost:8000).

## First-time setup

Run once from the project root:

```bash
npm run setup
```

That creates the API venv, installs Python and npm dependencies, copies `fundle.config.env.example` → `fundle.config.env` (if needed), and syncs env files. Then use `npm run dev` for daily development.

Local settings live in `fundle.config.env` (gitignored). Copy from `fundle.config.env.example` if needed.

**Debug:** set `DEBUG_FRESH=1` in `fundle.config.env` to reset guesses and reload the puzzle on every page refresh. Use `0` for normal daily persistence.

Local database file: `apps/api/fundle.db` (SQLite, created on first run).

### Daily puzzle

Puzzle day boundaries use **Europe/Amsterdam** (midnight NL time), not UTC.

Refresh today's puzzle from Funda (from the project root):

<details>
<summary><b>Windows</b></summary>

```powershell
cd apps\api
.\.venv\Scripts\Activate.ps1
python ..\..\scripts\build_daily_puzzle.py
```

</details>

<details>
<summary><b>Mac / Linux</b></summary>

```bash
cd apps/api
source .venv/bin/activate
python ../../scripts/build_daily_puzzle.py
```

</details>

**Production (Render):** add a **Cron Job** that runs daily at `5 0 * * *` with timezone **Europe/Amsterdam**:

- **Command:** `python ../../scripts/build_daily_puzzle.py`
- **Root directory:** `apps/api` (same as the web service)

This pre-builds the puzzle so the first visitor does not wait on Funda.

## Project layout

```
apps/api/     FastAPI + pyfunda
apps/web/     Next.js UI
scripts/      Cron-friendly puzzle builder
```

## Testing

Run the API test suite from the project root:

```bash
cd apps/api
uv run pytest
```

Lint the API with Ruff:

```bash
cd apps/api
uv run ruff check app tests
```

## License note

pyfunda is AGPL-3.0. Funda data is unofficial; use responsibly.
