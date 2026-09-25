# Quick-Poll Room

Zero-authentication live polling: create a room, share a link, watch votes land.

Monorepo layout:

- `backend/` — FastAPI + SQLite (`polls.db`)
- `frontend/` — React + Vite + Tailwind CSS + React Router v6

## Local development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

SQLite schema is created automatically on startup. Database file defaults to `backend/polls.db` (override with `DATABASE_PATH`).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The Vite dev server can also proxy `/api` to the backend (see `vite.config.js`).

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend | API origin, e.g. `http://127.0.0.1:8000` or your Render URL |
| `CORS_ORIGINS` | Backend | Comma-separated allowed origins (Vercel URL + localhost) |
| `CORS_ORIGIN_REGEX` | Backend (optional) | e.g. `https://.*\\.vercel\\.app` for preview deploys |
| `DATABASE_PATH` | Backend | SQLite file path on disk |

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/polls` | Body `{ "question": string, "options": string[2-5] }` → `201` |
| `GET` | `/api/polls/{poll_id}` | Full poll + vote counts, or `404` |
| `POST` | `/api/polls/{poll_id}/vote` | Body `{ "option_id": int }` — atomic increment → updated poll |
| `GET` | `/health` | Liveness check for Render |

Poll ids are 8-character URL-safe tokens (`secrets.token_urlsafe(6)`).

## Deploy

### Backend (Render)

1. Create a **Web Service** with root directory `backend`.
2. Build: `pip install -r requirements.txt`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set `CORS_ORIGINS` to your Vercel origin (no trailing slash).
5. Persist SQLite with a disk mounted at a path you pass as `DATABASE_PATH` (ephemeral disk will lose polls on every deploy).

### Frontend (Vercel)

1. Root directory: `frontend`.
2. Build command: `npm run build`
3. Output: `dist`
4. Set `VITE_API_BASE_URL` to the Render API origin (no trailing slash).
5. SPA fallback is configured in `frontend/vercel.json`.

## Product notes

No auth, no voter identity. Duplicate votes from the same browser are allowed. After a vote, the client polls for live tally updates every 2.5s.
