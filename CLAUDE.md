# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Sift / CopperGolem** — a Tauri desktop app for multimodal semantic file search. Users index a local folder; files are embedded via Gemini (768-dim vectors) and stored in MongoDB Atlas. A LangGraph agent answers natural-language questions about the files and can move/trash/rename them. The frontend renders indexed files as an interactive 3D constellation (Three.js).

## Running the app

**Full desktop app (recommended):**
```bash
cd front_end/desktop
npm install
npm run dev   # starts uvicorn on :8765, static server on :1420, opens Tauri window
```
`scripts/dev.sh` auto-discovers a Python venv at `./venv`, `./.venv`, `front_end/venv`, or `front_end/.venv`, and loads `.env` from `desktop/`, `front_end/`, or repo root. On Windows, system Python at `/c/Python31x/python` is also checked.

**FastAPI server only (no Tauri):**
```bash
cd front_end
python -m uvicorn server:app --host 127.0.0.1 --port 8765 --reload
# API docs at http://127.0.0.1:8765/docs
```

**Backend REPL (no server, no UI):**
```bash
cd backend && python agent.py   # interactive chat; empty line exits
```

## Required environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini embedding + chat model |
| `MONGO_URI` | MongoDB Atlas connection string |
| `YHACKS_FS_ROOT` | (optional) root path for file browse/preview; defaults to repo root |

## Architecture

Three independent layers — each can run standalone:

### 1. Backend library (`backend/`)
Pure Python. Core operations:
- `input_to_embedding.py` — multimodal Gemini embedding (text, images, PDFs → 768-float vector)
- `add_element.py` / `batch_process.py` — ingest files into MongoDB (`yhacks.files` collection)
- `query_elements.py` — `$vectorSearch` pipeline with cosine similarity + score-gap filtering
- `agent.py` — LangGraph chat agent (Gemini 2.5 Flash) with tools: `semantic_file_search`, `ask_about_files`, `preview_plan`, `execute_plan`, `trash_file`, `undo_last_action`, `index_directory`

MongoDB document shape: `{_id, filename, filepath, file_type, embedding: float[768], project_id, metadata}`

One-time setup: run `create_vector_index.py` to create the 768-dim cosine index on Atlas.

### 2. FastAPI server (`front_end/server.py`)
HTTP wrapper around the backend library. Key endpoints:
- `POST /api/chat` — agent conversation (`session_id`, `message`, `project_id`)
- `GET /api/semantic/search` — vector search (`q`, `k`, `min_score`, `project`)
- `GET /api/projection` — 2D PCA coords of all indexed files (used by constellation)
- `GET /api/file/preview` — render text/image/PDF as text or base64
- `POST /api/semantic/index` / `GET /api/index/stream` — index files (SSE stream)
- `GET /api/projects` / `POST /api/projects` / `DELETE /api/projects/{pid}` — project CRUD

Sessions are in-memory (`_sessions: dict[str, list]`). CORS is open (`allow_origins=["*"]`). Path access is gated by `_safe_resolve_under_roots()`.

### 3. Tauri desktop frontend (`front_end/desktop/`)
- **Rust shell** (`src-tauri/`) — window management, native folder picker dialog, bundled sidecar launch of uvicorn on startup, kills it on exit
- **React + Three.js UI** (`public/`) — no build step; Babel + React loaded from CDN at runtime
  - `index.html` — App component, wired to real backend
  - `constellation.jsx` — Three.js 3D node graph: MIME-colored stars, cartesian grid, cluster nebula gradients, raycaster hover/click
  - `ui.jsx` — all UI components: `AppHeader`, `SearchBar`, `PreviewPanel`, `ChatPanel` (slide-in agent drawer), `MiniMap`, overlays
  - `backend.jsx` — data adapter: `buildGraphFromBackend()` fetches `/api/projection`, `searchFiles()` hits `/api/semantic/search`, `fetchFilePreview()` hits `/api/file/preview`; falls back to demo data (`PROJECTS`) if backend is unreachable
  - `tweaks-panel.jsx` — dev settings panel (star density, motion, logo variant, etc.)

**Data flow for search:** user types query → `backend.jsx:searchFiles()` → `/api/semantic/search` → `query_elements.py:similarity_search_with_score()` → MongoDB `$vectorSearch` → scored hits mapped back to graph nodes → constellation highlights matching stars + camera flies to cluster.

**Data flow for indexing:** user triggers index → SSE from `/api/index/stream` → Tauri UI shows pipeline overlay → `batch_process.py` embeds each file → stores in Atlas.

## Manual testing (no test suite)

```bash
# Verify MongoDB + Gemini connectivity
python backend/mongo_test_connect.py
python backend/input_embedding_sample_test.py

# Ingest a file and query it
python backend/add_element.py          # edit TARGET_FILE at bottom
python backend/query_elements.py       # edit query at bottom

# HTTP smoke tests (server must be running)
curl http://127.0.0.1:8765/health
curl "http://127.0.0.1:8765/api/semantic/search?q=auth&k=5"
```

## Key constraints

- **Python 3.11+** required (uses `str | None` union syntax, `match` statements)
- **Windows PATH quirk**: `python3` on Windows resolves to the Microsoft Store stub; `dev.sh` explicitly checks `/c/Python31x/python` paths and skips `WindowsApps` entries
- **Embedding model**: `gemini-embedding-2-preview` outputs exactly 768 dims — the Atlas vector index is hard-coded to this dimension; changing models requires dropping and recreating the index
- **Project isolation**: files in MongoDB are tagged with `project_id`; search and projection endpoints filter by this field when `project` param is non-empty
