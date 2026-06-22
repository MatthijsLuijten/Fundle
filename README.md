# Fundle

Guess the Funda asking price in 5 tries. Each wrong guess unlocks more hints (area, energy label, photo, etc.).

## Stack

- **Frontend:** Next.js (`apps/web`)
- **Backend:** FastAPI + pyfunda (`apps/api`)
- **Database:** PostgreSQL (Docker)

## Daily use

From the **project root**, one command starts the API and web together (no venv activation, no second terminal):

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API runs on [http://localhost:8000](http://localhost:8000).

Prefer separate windows? Run `.\dev.ps1` instead (same services, two PowerShell tabs).

## First-time setup

Run once from the project root:

```powershell
.\setup.ps1
```

That creates the API venv, installs Python and npm dependencies, copies `fundle.config.env.example` → `fundle.config.env` (if needed), and syncs env files. Then use `npm run dev` for daily development.

Local settings live in `fundle.config.env` (gitignored). The committed `fundle.config.env.example` has safe defaults (`DEMO_MODE=1`).

<details>
<summary>Manual setup (if you prefer)</summary>

**API** (SQLite by default — no Docker needed):

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

**Web:**

```powershell
cd apps\web
npm install
copy .env.local.example .env.local
```

From the project root: `npm install` (for `concurrently`). Daily dev: `npm run dev`.

</details>

**Debug:** set `DEBUG_FRESH=1` in `fundle.config.env` to reset guesses and reload the puzzle on every page refresh. Use `0` for normal daily persistence.

### PostgreSQL (optional)

```powershell
docker compose up -d
```

Set `DATABASE_URL=postgresql+psycopg://fundle:fundle@localhost:5432/fundle` in `apps/api/.env`.

### Daily puzzle (live mode)

With `DEMO_MODE=0`, refresh today's puzzle from Funda:

```powershell
cd apps\api
.\.venv\Scripts\Activate.ps1
python ..\..\scripts\build_daily_puzzle.py
```

## Project layout

```
apps/api/     FastAPI + pyfunda
apps/web/     Next.js UI
scripts/      Cron-friendly puzzle builder
```

## License note

pyfunda is AGPL-3.0. Funda data is unofficial; use responsibly.
