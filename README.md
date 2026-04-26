# Sift / CopperGolem

Multimodal semantic file search and a chat-driven file organizer built on **Google Gemini** (multimodal embeddings + LLM), **MongoDB Atlas Vector Search**, **FastAPI**, and a **Tauri** desktop UI.

The repo has three layers, each runnable on its own:

1. **Backend library** ([backend/](backend/)) — Python modules that index files into MongoDB Atlas (`gemini-embedding-2-preview`, 768 dims) and query them with `$vectorSearch`. Includes a LangGraph chat agent ([backend/agent.py](backend/agent.py)) with tools for search, multimodal Q&A on local files, file moves/trash, and undo.
2. **FastAPI server** ([front_end/server.py](front_end/server.py)) — wraps the backend over HTTP: `/api/chat`, `/api/semantic/search`, `/api/semantic/index`, `/api/semantic/index_directory`, `/api/file/preview`, `/api/browse`, `/health`.
3. **Tauri desktop app** ([front_end/desktop/](front_end/desktop/)) — small always-on-top window that talks to the FastAPI server.

---

## Prerequisites

- **Python 3.11+** (tested with 3.12)
- **MongoDB Atlas** cluster with **Vector Search** enabled. `$vectorSearch` does **not** run against a default local `mongod`.
- **Gemini API key** with access to embedding (`gemini-embedding-2-preview`) and chat (`gemini-2.5-flash`) models
- **libmagic** for `python-magic`:
  - macOS: `brew install libmagic`
  - Debian/Ubuntu: `sudo apt install libmagic1`
- **For the desktop app only:** Node.js 18+, Rust toolchain (`rustup` → `cargo`), and Tauri's [system prerequisites](https://tauri.app/start/prerequisites/)

---

## One-time setup

From the repo root ([Gemini2026/](.)):

```bash
# 1. Create and activate a venv (Python 3.11+)
python3.12 -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate

# 2. Install Python deps (covers backend + FastAPI server + agent)
pip install -r front_end/requirements.txt send2trash

# 3. Set environment variables
export GEMINI_API_KEY='your-gemini-key'
export MONGO_URI='mongodb+srv://USER:PASS@cluster.mongodb.net/?appName=...'
# Optional: confine all agent file ops to one directory (default: cwd)
export YHACKS_FS_ROOT="$(pwd)"
```

You can also drop the same `KEY=VALUE` lines into a `.env` file at the repo root, in [front_end/](front_end/), or in [front_end/desktop/](front_end/desktop/) — [front_end/env_bootstrap.py](front_end/env_bootstrap.py) loads them via `python-dotenv` when the FastAPI server starts.

### Create the Atlas Vector Search index (once)

```bash
cd backend
python create_vector_index.py
```

Then in the **Atlas UI** → cluster → Database → `yhacks` → `files` → **Search Indexes**, wait until the index named **`vector_index`** shows status **READY** (can take a few minutes). The pipeline returns `[]` until then.

The index definition (also in [backend/create_vector_index.py](backend/create_vector_index.py)):

| Field | Value |
|---|---|
| Database | `yhacks` |
| Collection | `files` |
| Index name | `vector_index` |
| Vector path | `embedding` |
| Dimensions | **768** (must match Gemini `output_dimensionality`) |
| Similarity | `cosine` |
| Filter | `file_type` |

### Smoke-test the connections

```bash
# MongoDB
python backend/mongo_test_connect.py            # prints "Pinged your deployment..."
# Gemini embedding
python backend/input_embedding_sample_test.py   # edit path in file first, prints a 768-vector
```

---

## Layer 1 — Run the backend library directly

Run from inside [backend/](backend/) so the sibling imports resolve.

```bash
cd backend
source ../venv/bin/activate
```

| Task | Command |
|---|---|
| Ingest one file | Edit the path at the bottom of [backend/add_element.py](backend/add_element.py), then `python add_element.py` — or import `ingest_file_to_db(path, description=None)`. |
| Ingest a folder (recursive) | Edit `TARGET_DIRECTORY` in [backend/batch_process.py](backend/batch_process.py), then `python batch_process.py`. Allowed extensions: `.pdf .png .jpg .jpeg .txt .md`. |
| Search by meaning | `python query_elements.py` (edit the query string at the bottom), or call `similarity_search_with_score(query, k=3)`. Returns `[(doc, score), ...]`. |
| Delete from index | `python remove_elements.py` (or import `remove_by_filename` / `remove_by_type` / `remove_by_id` / `reset_database`). Note: this only removes Mongo rows — files on disk are untouched. |
| Update path/metadata in place | [backend/update_element.py](backend/update_element.py) — CLI form: `python update_element.py <ObjectId> <new_filepath>`. Use `$set` semantics so the existing `embedding` is preserved. |
| Chat agent (REPL) | `python agent.py` — empty line exits. |

### LangGraph agent ([backend/agent.py](backend/agent.py))

Tools registered on the model:

| Tool | What it does |
|---|---|
| `semantic_file_search(query, k=5)` | Vector search via `similarity_search_with_score`. |
| `ask_about_files(question, file_paths)` | Reads up to 10 local files (≤100 MiB each) and answers via multimodal `ChatGoogleGenerativeAI`. `file_paths` is a JSON array of relative paths or a single relative path. Does **not** require MongoDB. |
| `trash_file(path, mongo_id)` | `send2trash` + remove the matching vector row. Records an undo batch. |
| `preview_plan(plan_json)` | Show what a JSON plan would do (no side effects). |
| `execute_plan(plan_json, dry_run=False)` | Always shows the preview first, then runs each step. Records one undo batch. |
| `undo_last_action()` | LIFO undo of the last `execute_plan` / `trash_file` batch. |

**Plan JSON** is an array of step objects. Supported actions: `create_folder`, `move_file` (`from`, `to`, optional `mongo_id`), `remove_file` (`path` and/or `mongo_id`, sends to system Trash), `add_file` (`path`, optional `description`), `remove_folder` (Trash + delete DB rows under path; **not** undoable). All paths are confined to `YHACKS_FS_ROOT` (or cwd at startup).

Agent-specific environment:

| Variable | Required | Default |
|---|---|---|
| `GEMINI_API_KEY` | yes | — |
| `MONGO_URI` | for `semantic_file_search` only | localhost (no vector index → empty results) |
| `YHACKS_FS_ROOT` | no | cwd at process start |
| `AGENT_MODEL` | no | `gemini-2.5-flash` |

---

## Layer 2 — Run the FastAPI server

Run from [front_end/](front_end/) so its `import server` and the relative `backend/` import path work.

```bash
cd front_end
source ../venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 8765 --reload
```

Open `http://127.0.0.1:8765/docs` for the auto-generated OpenAPI UI.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | Reports whether `MONGO_URI` pings and whether `GEMINI_API_KEY` is set. |
| `POST` | `/api/session/new` | Allocate a new in-memory chat session id. |
| `GET`  | `/api/agent/tools` | List agent tool names + descriptions and the active `fs_root`. |
| `POST` | `/api/chat` | Send `{"session_id": "...", "message": "..."}`; returns `{reply, found_files, tools_used, is_plan_proposal}`. |
| `GET`  | `/api/browse?rel_path=...` | List directory entries under the configured workspace roots. |
| `GET`  | `/api/file/preview?rel_path=...` | Returns text / image (base64) / PDF (base64) for previewing. Caps: 20 MiB (text/image), 40 MiB (PDF). |
| `GET`  | `/api/semantic/search?q=...&k=10&min_score=0.60` | Pure semantic search, with score-gap filtering on the server. |
| `POST` | `/api/semantic/index` | Body `{file_path, description}` — index a single file. |
| `POST` | `/api/semantic/index_directory` | Body `{rel_path}` — index every supported file under a directory (extensions: `.pdf .png .jpg .jpeg .txt .md .webp .gif`). |
| `GET`  | `/api/workspace/roots` | List the directories the server is willing to read. |

### Server-only environment

| Variable | Default | Notes |
|---|---|---|
| `COPPERGOLEM_NO_PARENT_ROOT` | unset | Set non-empty to **stop** the server from auto-allowing the repo's parent directory as a workspace root. |
| `COPPERGOLEM_EXTRA_ROOTS` | unset | Extra workspace roots, separated by `|`, `;`, or `:`. Browse / preview / index_directory are confined to these roots + the repo (+ optional parent). |
| `YHACK_ROOT` | unset | Friendly alias: if set, becomes `YHACKS_FS_ROOT` and (when `COPPERGOLEM_EXTRA_ROOTS` is empty) is also added to the workspace roots. Resolved against `~/Downloads`, cwd, and `front_end/` if not absolute. |

---

## Layer 3 — Run the Tauri desktop app

The desktop app expects the FastAPI server on `127.0.0.1:8765` and serves the static UI from [front_end/desktop/public/](front_end/desktop/public/) on `127.0.0.1:1420` during dev. The `tauri dev` flow runs both for you via [front_end/desktop/scripts/dev.sh](front_end/desktop/scripts/dev.sh).

```bash
cd front_end/desktop
npm install
npm run dev          # starts FastAPI (uvicorn) + static server + Tauri dev window
```

The dev script auto-discovers a venv at `./venv`, `./.venv`, `front_end/venv`, or `front_end/.venv`; otherwise it falls back to `python3` on `PATH`. Make sure `GEMINI_API_KEY` and `MONGO_URI` are exported in the same shell, or sit in a `.env` next to one of those venv candidates.

To produce a release `.app` / `.dmg`:

```bash
cd front_end/desktop
npm run build
```

In a packaged build, [front_end/desktop/src-tauri/src/backend.rs](front_end/desktop/src-tauri/src/backend.rs) launches `python3 -m uvicorn server:app` from the bundled Resources folder and waits up to 45s for port 8765. Override the Python it uses with `COPPERGOLEM_PYTHON=/abs/path/to/python`. Backend logs go to `$TMPDIR/coppergolem-backend.log`.

---

## Stored document shape

Every successful ingest inserts one document into `yhacks.files`:

```json
{
  "_id": "ObjectId(...)",
  "filename": "diagram.png",
  "filepath": "/absolute/path/to/diagram.png",
  "file_type": "image/png",
  "embedding": [0.0123, -0.0456, "...768 floats..."],
  "metadata": {
    "file_size": 12345,
    "description_provided": false
  }
}
```

`query_elements.similarity_search_with_score` runs the pipeline:

```python
[
  {"$vectorSearch": {
      "index": "vector_index",
      "path":  "embedding",
      "queryVector": <gemini RETRIEVAL_QUERY embedding>,
      "numCandidates": max(50, k * 10),
      "limit": k,
  }},
  {"$project": {
      "_id": 1, "filename": 1, "file_type": 1, "filepath": 1,
      "page_range": 1,
      "score": {"$meta": "vectorSearchScore"},
  }},
]
```

Vector indexes only **register** with `create_search_index` — the actual matching happens when you call `collection.aggregate(pipeline)`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `similarity_search_with_score` always returns `[]` | Vector index not yet **READY** in Atlas, or `MONGO_URI` unset (PyMongo silently falls back to `localhost:27017`), or index name in Atlas ≠ `vector_index`. |
| `ImportError: failed to find libmagic` | `brew install libmagic` (macOS) / `apt install libmagic1` (Debian). |
| `Set GEMINI_API_KEY in the environment before running the agent.` | Export it, or put it in a `.env` next to `server.py` / repo root. |
| `Plan preview` fails with "Path must be under project root" | The plan referenced a path outside `YHACKS_FS_ROOT`. Either change the path or set `YHACKS_FS_ROOT` to a parent. |
| Tauri dev window starts but chat 500s | FastAPI couldn't reach Mongo or import the agent — check the uvicorn output and `/health`. |
| `ask_about_files` fails on large PDFs | In-code cap is 100 MiB/file; Gemini also enforces its own request/token caps. Split or use the File API for huge inputs. |
| Agent trash/remove returns "send2trash is not installed" | `pip install send2trash` (already in the setup step above). |

---

## Repo layout

```
.
├── backend/                       # Library + LangGraph agent
│   ├── input_to_embedding.py      # Gemini multimodal embed (768 dims)
│   ├── add_element.py             # ingest_file_to_db()
│   ├── batch_process.py           # walk a directory and ingest
│   ├── create_vector_index.py     # one-time Atlas vector index creation
│   ├── query_elements.py          # similarity_search_with_score()
│   ├── remove_elements.py         # delete docs by filename / type / _id
│   ├── update_element.py          # $set updates (path/filename/metadata)
│   ├── mongo_test_connect.py      # connectivity smoke test
│   ├── input_embedding_sample_test.py
│   └── agent.py                   # LangGraph REPL + tools
├── front_end/
│   ├── requirements.txt           # Python deps for backend + server + agent
│   ├── env_bootstrap.py           # loads .env files, normalizes YHACK_ROOT
│   ├── server.py                  # FastAPI app
│   └── desktop/                   # Tauri shell (Node + Rust)
│       ├── package.json
│       ├── public/                # static UI (HTML/JS/CSS)
│       ├── scripts/dev.sh         # starts uvicorn + static server for `tauri dev`
│       └── src-tauri/             # Rust glue + tauri.conf.json
├── other_files/
│   └── fake_agent.py              # standalone reference agent (not wired into the app)
├── design.md                      # original Sift design spec
└── README.md
```
