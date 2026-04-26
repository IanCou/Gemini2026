# Nebula — Progress Log

---

## Session 3 — 2026-04-26

### What was done

**Bug fixes (search & indexing)**
- `query_elements.py` — rewrote project-scoped search to use exact in-memory cosine similarity (numpy) instead of Atlas ANN + post-filter. Atlas ANN was dominated by noise from unrelated projects, so project files never appeared in results. This was the root cause of the chat agent saying "I couldn't find any files containing python."
- `backend.jsx` — fixed `searchFiles` to return results even when a file has no matching constellation node. Unmatched hits now get synthetic nodes (`id < 0`) so they still appear in the search results panel.
- `backend.jsx` — fixed `fetchFilePreview` field names (`d.kind`, `d.content`, `d.mime` — was using wrong names `d.type`, `d.base64`, `d.mime_type`).

**UI fixes**
- `index.html` — fixed `projectRoot` state to store project ID instead of folder path. Was causing all projection/search API calls to fail silently.
- `index.html` — added `selectedNodeOverride` state so clicking a search result that isn't in the constellation still opens the preview panel.
- `index.html` — `selectedNode` now falls back to `selectedNodeOverride`; `onNodeClick` and `PreviewPanel` close/neighbor-pick clear the override correctly.
- `index.html` — added real SSE indexing via `startIndexing(pid)` that connects to `/api/index/stream` and drives the `PipelineBar`.
- `index.html` — API key indicator now correctly shows green on load by fetching `/health`.
- `ui.jsx` — added `PipelineBar` component at the bottom showing real indexing stages (loaded → gemini-embed → atlas-insert → done) with progress bars and a recent-file ticker.
- `ui.jsx` — `SettingsButton` shows "Loaded from .env ✓" placeholder when key is read from environment.

**Dev workflow**
- Added `"backend": "bash scripts/dev.sh"` script to `front_end/desktop/package.json`.
- `npm run dev` in `front_end/desktop/` now starts everything (Tauri calls `dev.sh` as `beforeDevCommand`, which boots FastAPI on 8765 + static server on 1420, then Tauri opens the desktop window).

### Current state

- App runs end-to-end: `npm run dev` from `front_end/desktop/` launches the full stack.
- Backend health: MongoDB connected ✓, Gemini key loaded from `.env` ✓.
- Semantic search works for project-scoped queries (exact cosine similarity).
- Preview panel opens for both constellation nodes and search-only hits.
- Indexing pipeline visualized in real time via SSE.

### Known gaps / next steps

- Agent chat (`/api/chat`) uses Gemini 2.5 Flash — verify tool calls surface file results correctly in the chat panel after the `query_elements.py` fix.
- `project_id` is not a filter field in the Atlas vector index (`create_vector_index.py`) — unscoped global search still uses ANN which may miss files. Add `project_id` as a filter field and expose an admin endpoint to recreate the index.
- Indexing performance: sequential per-file embedding calls. Implement `ThreadPoolExecutor` (10 workers), incremental hashing, and bulk MongoDB upserts per design.md §11.
- Score waterfall visualization (design.md §5.3) not yet implemented.
- Streaming token output for chat (design.md §4.2) not yet implemented — currently full-response JSON.
- Windows packaging not started.

---

## Session 2 — (prior)

- Full UI rewrite: constellation 3D view (Three.js), search bar, preview panel with find-in-file, chat panel, onboarding overlay, pipeline bar, minimap, tweaks panel.
- FastAPI server (`front_end/server.py`): projects CRUD, `/api/projection`, `/api/semantic/search`, `/api/index/stream` (SSE), `/api/file/preview`, `/api/chat`, `/api/session/new`, `/api/dialog/pick_folder`, `/api/settings/apikey`.
- MongoDB document tagging with `project_id` for scoped searches.
- Gemini API key rotation (old key quota-exhausted → new key in `.env`).

## Session 1 — (prior)

- Backend engine: `input_to_embedding.py`, `add_element.py`, `batch_process.py`, `query_elements.py`, `agent.py`, `create_vector_index.py`.
- Initial Tauri shell and FastAPI wiring.
- MongoDB Atlas vector index (768-dim cosine, filter on `file_type`).
