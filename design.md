# Sift — Multimodal Semantic Codebase Engine
**Desktop App Design Specification (macOS + Windows)**
*Hackathon Track: Developer Tools*

---

## 1. The Pitch (30 seconds)

> Modern AI coding agents are **pixel-blind**. They navigate codebases with `grep` and `find`, which fail the moment a screenshot is named `IMG_9921.png`, a flowchart lives in `whiteboard_v3.pdf`, or the user asks "where's the auth diagram?"
>
> **Sift** is a desktop app that gives every coding agent — Antigravity, Cursor, Aider, Claude Code — a multimodal semantic memory of your repo. It indexes code, PDFs, and **images** with Google's multimodal Gemini embeddings, stores them in MongoDB Atlas Vector Search, and exposes the search to agents over a tiny local HTTP API. The user gets a slick **always-on-top chat window** with **live visualizations** of the embedding space, the indexing pipeline, and the agent's tool calls.
>
> One install (.dmg or .msi). Zero config in the target repo. Your AI coworker can finally see.

---

## 2. Why This Wins the Dev-Tool Track

Judges in this track reward three things, and Sift hits all three:

| Criterion | Sift's answer |
|---|---|
| **Real, common pain** | Every agent demo today does `grep -r 'TODO'`. That breaks on PDFs, images, and intent-based queries. Universal pain. |
| **A unique, demoable wow moment** | "Find the architecture diagram" → agent finds `IMG_9921.png` *by what's drawn on the whiteboard*. Pixel-level recall, on stage, in 3 seconds. |
| **Composable with the rest of the ecosystem** | Sift doesn't replace anyone. It augments Antigravity / Cursor / Aider via a 1-file rules drop-in and a localhost API. |

The desktop app is what makes it demoable: a tiny copper-colored window floats over the IDE, the user types in chat, and a constellation of file embeddings lights up in real time. That's the screenshot judges remember.

---

## 3. Cross-Platform Architecture

The whole app is one **Tauri 2** binary that bundles:

- A **Rust shell** that owns the window, the system tray, file-drop handling, and lifecycle of the Python sidecar.
- A **Python FastAPI sidecar** (uvicorn on `127.0.0.1:8765`) that owns Gemini calls, MongoDB Atlas, indexing, and the agent.
- A **static web UI** (HTML / JS / CSS, no framework lock-in) served by Tauri's WebView, running entirely offline-capable except for the Gemini + Atlas calls.

```
┌────────────────────────────────────────────────────────────────┐
│  Sift Desktop App  (Tauri 2 — single binary)                   │
│                                                                │
│   ┌────────────────────────────┐    ┌──────────────────────┐   │
│   │  WebView (HTML/JS/CSS)     │◄──►│  Rust shell          │   │
│   │   - Chat panel             │    │   - window mgmt      │   │
│   │   - Visualization canvas   │    │   - tray icon        │   │
│   │   - Search bar             │    │   - file drop        │   │
│   │   - Activity feed          │    │   - sidecar lifetime │   │
│   └────────────┬───────────────┘    └──────────┬───────────┘   │
│                │ HTTP fetch                     │ spawn/kill   │
│                ▼                                ▼              │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Python sidecar  (uvicorn :8765)                        │  │
│   │   - FastAPI: /api/chat, /api/semantic/search,           │  │
│   │     /api/semantic/index_directory, /api/file/preview    │  │
│   │   - LangGraph agent (Gemini 2.5 flash + tools)          │  │
│   │   - input_to_embedding.py (gemini-embedding-2-preview)  │  │
│   └────────────────────┬───────────────────┬────────────────┘  │
│                        │                   │                   │
└────────────────────────┼───────────────────┼───────────────────┘
                         ▼                   ▼
            ┌──────────────────────┐  ┌─────────────────────┐
            │  MongoDB Atlas       │  │  Google Gemini API  │
            │  Vector Search       │  │  - embedding-2      │
            │  (768-dim, cosine)   │  │  - 2.5 flash chat   │
            └──────────────────────┘  └─────────────────────┘
```

### Platform parity (must run on both)

| Concern | macOS | Windows |
|---|---|---|
| Bundle | `.dmg` and `.app` (Apple-signed if cert avail.) | `.msi` and `.exe` via `cargo-tauri build --target x86_64-pc-windows-msvc` |
| Python runtime | System `python3` ≥ 3.11; auto-detect at `/opt/homebrew/bin/python3`, `/usr/local/bin/python3`, `/usr/bin/python3` | Embedded `python-3.12.x-embed-amd64` shipped inside the bundle's `Resources\python\`. No system Python required. |
| `libmagic` | `brew install libmagic` listed as prereq; fallback to `mimetypes` if missing | Bundle `libmagic-1.dll` from `python-magic-bin` wheel. Already shipped via pip on Windows. |
| Trash for `remove_file` | `send2trash` → `~/.Trash` (boot vol) or `.Trashes/$uid` (external). Restorable via `undo_last_action`. | `send2trash` → Recycle Bin via `SHFileOperation`. Restorable via `undo_last_action`. |
| Always-on-top window | Native via Tauri | Native via Tauri |
| File-drop into chat | Native via Tauri `onDrop` | Native via Tauri `onDrop` |
| First-run config | Settings pane writes `~/Library/Application Support/Sift/.env` | Settings pane writes `%APPDATA%\Sift\.env` |
| CI build | GitHub Actions: `macos-latest` (universal) + `windows-latest` |

**Build matrix in CI** (`.github/workflows/release.yml`):

```yaml
strategy:
  matrix:
    include:
      - { os: macos-latest,   target: aarch64-apple-darwin,    py: macos-arm64 }
      - { os: macos-latest,   target: x86_64-apple-darwin,     py: macos-x86_64 }
      - { os: windows-latest, target: x86_64-pc-windows-msvc,  py: win-amd64-embed }
```

Both bundles include the Python sidecar's `requirements.txt` deps wheel-installed into a relocatable site-packages folder shipped inside Resources, so the user does **zero `pip install`**. First launch checks the Atlas vector index, prompts for `GEMINI_API_KEY` + `MONGO_URI` if missing, and runs `create_vector_index.py` automatically.

---

## 4. The Chatbot — UX, Behavior, Tools

The chatbot is the centerpiece. It's a streaming LangGraph agent (Gemini 2.5 Flash), surfaced in a chat panel with everything the user expects from a modern AI assistant **plus** semantic file context.

### 4.1 Chat panel layout

```
┌─────────────────────────────────────────────────────┐
│  Sift   [▽ workspace: ~/code/myapp]  ⚙   _  ☐  ✕   │  ← traffic-light bar
├─────────────────────────────────────────────────────┤
│                                                     │
│  [user]  find the auth diagram                      │
│                                                     │
│  [agent]  🔍 semantic_file_search("auth diagram")   │  ← inline tool call chip
│                                                     │
│           ┌─────────────────────────────────┐       │
│           │  IMG_9921.png    score: 0.91    │       │  ← preview card (drag to IDE)
│           │  [thumbnail rendered inline]    │       │
│           └─────────────────────────────────┘       │
│                                                     │
│           Found one strong match: an OAuth          │
│           whiteboard photo. Open it?                │
│                                                     │
│  [user]  yes, and rename it to oauth_diagram.png    │
│                                                     │
│  [agent]  🛠 execute_plan (preview first)           │  ← plan-confirm card
│           [✓ Confirm]   [✗ Cancel]                  │
│                                                     │
├─────────────────────────────────────────────────────┤
│  > _________________________________________  ⏎    │  ← input + drop zone
└─────────────────────────────────────────────────────┘
```

### 4.2 Chat behavior contract

- **Streaming token output** via Server-Sent Events from `/api/chat/stream` (FastAPI's `EventSourceResponse`). Tokens appear character-by-character; tool calls appear as inline chips that expand on click.
- **Multimodal input.** Drag a PDF or image onto the input field. The chat embeds it as a Gemini multimodal message via `ask_about_files` — answers about the file's contents without first indexing it.
- **Score-gap filtering.** When `semantic_file_search` returns 10 results and the top 2 are 0.69 / 0.68 and the rest are 0.55 / 0.54 / …, the agent only surfaces the top 2 to the user, with a "show 8 weaker matches" expander. Implementation: `_filter_by_score_gap()` in `front_end/server.py`.
- **Plan preview before destructive ops.** Any `move_file`, `remove_file`, or `remove_folder` is shown as a two-button card the user must click before execution. The agent system prompt enforces this; the UI also gates `dry_run=False` calls behind explicit user click.
- **Undo button** in the header — calls `undo_last_action` on demand.
- **Workspace switcher.** A dropdown in the header changes `YHACKS_FS_ROOT` per session, so one app instance can target multiple repos.
- **Sessions persist across restarts.** Chat history serializes to `~/.sift/sessions/<id>.jsonl`; the app reopens the last active session.

### 4.3 Tool inventory (registered on the model)

| Tool | Purpose | UI affordance |
|---|---|---|
| `semantic_file_search` | Vector search over indexed files | Inline result cards with thumbnails + score bars |
| `ask_about_files` | Multimodal Q&A on local files (drag-and-drop or path) | Attached-file pill above the user message |
| `index_directory` | Bulk-index a folder | Live progress bar streamed to the visualization layer |
| `preview_plan` / `execute_plan` | Two-stage destructive-op flow | Confirm/cancel card |
| `trash_file` | One-shot send-to-Trash | Confirm modal |
| `undo_last_action` | LIFO undo | Header button + slash command `/undo` |
| `open_in_ide` | Hand off a hit to Antigravity / Cursor / VSCode via `code --goto` | Link on every result card |

### 4.4 Slash commands (power-user)

`/index <path>` · `/search <query>` · `/undo` · `/clear` · `/settings` · `/copy-rules` (writes the Antigravity/Cursor rules file into the active workspace).

---

## 5. Flashy Visualizations (the demo-stealing part)

Visualizations live on a **WebGL canvas** (Three.js or pixi.js) that overlays the right-hand panel of the app. Three modes, switchable from a pill at the top of the panel:

### 5.1 Constellation View (default)

A **2-D UMAP projection** of every indexed file's 768-dim embedding into screen space. Each file is a node colored by MIME type:

- code = green pulse
- image = amber star
- pdf = red diamond
- text/md = blue circle

When the user types a query in the chat:

1. The query embedding is computed on the server.
2. The query is projected into the same UMAP space (using the persisted UMAP model — `umap-learn` saved to `~/.sift/umap.pkl`, retrained nightly or on `/index_directory` finish).
3. The query appears as a **pulsing white reticle** at its projected position.
4. The k=5 nearest nodes light up; lines beam from the reticle to each, weighted by score.
5. Hover any node for a thumbnail tooltip; click to open in the chat.

This is the "wow" frame. Judges see file embeddings cluster by *meaning*, watch a query land in the cluster, and get a visceral feel for the multimodal embedding.

### 5.2 Pipeline View (during indexing)

A **horizontally-flowing pipeline animation** for the indexer, like a Sankey + status bar:

```
discovered ──► loaded ──► gemini-embed ──► atlas-insert ──► done
   142        ▒▒▒▒87       ▒▒▒▒62           ▒▒▒▒60         60
```

Each file is a tiny token that physically slides through the pipeline. Failed files turn red and stack at the bottom. Watching a hundred files chunk through Gemini in 30 seconds reads as "real engineering" on a demo screen.

Powered by an SSE stream from `POST /api/semantic/index_directory` that emits `{event: "stage", file, stage}` JSON lines. The UI maintains a fixed-size pool of token sprites via WebGL.

### 5.3 Score Waterfall (during search)

When a `semantic_file_search` call resolves, a horizontal bar chart slides in below the results: bars sorted by score, with the **score-gap threshold** drawn as a dashed line — everything below the line is grayed out. Click a bar to scroll to that result.

This is what teaches the user (and the judges) why Sift returned 2 instead of 10. It makes the score-gap heuristic *visible*.

### 5.4 Activity Feed (always-on, bottom strip)

A monospace ticker that prints every tool call and HTTP hit in real time, like Postgres `log_min_duration_statement`:

```
[14:02:11] POST /api/chat   session=ab12   ✓ 412ms
[14:02:11]  └─ tool semantic_file_search("auth diagram")  → 2 hits  (0.91, 0.78)
[14:02:11]  └─ tool open_in_ide("IMG_9921.png")          → ok
[14:02:18] POST /api/semantic/index_directory  rel=docs/  files=87  ▒▒▒▒
```

The feed makes the system's internals legible. Hackathon judges *love* legible internals.

### 5.5 Settings + onboarding visuals

- First-run wizard with three steps and animated checkmarks:
  1. Paste `GEMINI_API_KEY` (test button hits `models.embed_content`)
  2. Paste `MONGO_URI` (test button pings Atlas)
  3. Pick a workspace folder
- After setup, a 5-second onboarding constellation seeds itself from the user's folder so the visualization is non-empty on first open.

---

## 6. The Engine (already built — see [README.md](README.md))

The engine layer is unchanged from the current implementation:

| Module | Role |
|---|---|
| [backend/input_to_embedding.py](backend/input_to_embedding.py) | Multimodal Gemini embedding (`gemini-embedding-2-preview`, 768 dims). Branches on MIME — text-like files use the `text` field; images / PDFs go via `Part.from_bytes`. |
| [backend/add_element.py](backend/add_element.py) | `ingest_file_to_db(path, description)` — embed + Atlas insert. |
| [backend/batch_process.py](backend/batch_process.py) | Recursive directory ingest. |
| [backend/query_elements.py](backend/query_elements.py) | `$vectorSearch` pipeline + `$project` with `vectorSearchScore`. |
| [backend/agent.py](backend/agent.py) | LangGraph REPL with all tools above. |
| [backend/create_vector_index.py](backend/create_vector_index.py) | One-shot Atlas vector index bootstrap (768-dim, cosine, filter on `file_type`). |
| [front_end/server.py](front_end/server.py) | FastAPI app exposing all tools + file preview + score-gap filtering. |
| [front_end/desktop/](front_end/desktop/) | Tauri 2 shell (Rust + HTML/JS) — currently always-on-top hover window; the redesign expands it into a full chat panel + canvas. |

### Stored document shape

```json
{
  "_id": "ObjectId",
  "filename": "IMG_9921.png",
  "filepath": "/abs/path/IMG_9921.png",
  "file_type": "image/png",
  "embedding": [0.012, -0.044, "...768 floats"],
  "metadata": {
    "file_size": 482133,
    "description_provided": false
  }
}
```

### Vector index

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "file_type" }
  ]
}
```

---

## 7. IDE Integration (the "augments everyone" angle)

A one-click button in the header — **"Install rules in active workspace"** — drops a single file into the workspace root that retargets every popular agent at Sift's localhost API:

```
.cursorrules
.antigravity_rules
AGENTS.md
.aider.conf.yml
```

The rules content:

```text
You have access to a local semantic search engine called Sift, running on
http://127.0.0.1:8765. Sift can see inside images and PDFs.

When you need to find a file, locate a diagram, understand the architecture,
or look for context, DO NOT use grep, find, or fuzzy file search first.
Instead, fetch:

  GET http://127.0.0.1:8765/api/semantic/search?q=<urlencoded>&k=5

Read the JSON `hits` array. Each hit has `filename`, `filepath`, `file_type`,
and `score`. Trust hits with score ≥ 0.65; ignore the rest. Open files via
`filepath`. Fall back to grep only if no hits clear the threshold.
```

Judges who use Cursor / Antigravity recognize the file format instantly. The pitch lands without explanation.

---

## 8. Demo Script (3-minute live run, dev-tool track)

> *Goal: make the judges say "oh damn" within 30 seconds and "I'd install this" within 3 minutes.*

**0:00 — Hook (15s).** Open the IDE side-by-side with Sift's hover window. Have an unindexed `demo_repo/` open with a screenshot named `IMG_9921.png` (a real whiteboard photo) and a few code files.

**0:15 — The flaw (20s).** Ask the IDE's built-in agent: *"Find the architecture diagram."* It does `grep -ri 'architecture'` and returns nothing. Pause. Say: "This is the pixel-blind problem."

**0:35 — Index (30s).** Click "Index workspace" in Sift. The **Pipeline View** lights up. 87 files flow through `loaded → embed → atlas` in 25 seconds. Ambient music goes well here.

**1:05 — Constellation (30s).** Auto-switch to the Constellation View. ~90 nodes appear, clustered by MIME color. Pan a bit. The audience now *sees* a brain.

**1:35 — The wow (45s).** Type in chat: *"find the architecture diagram."* The white reticle lands inside the image cluster. A line beams to `IMG_9921.png` at 0.91. The result card renders the actual whiteboard photo. **Score Waterfall** confirms: top hit is far above the rest.

**2:20 — The agent (30s).** Type: *"rename it to oauth_diagram.png and update the doc that imports it."* Sift previews a 2-step plan, you click confirm. Activity Feed scrolls. Done.

**2:50 — The plug (10s).** Click "Install rules in workspace." Show the dropped `.antigravity_rules` file. Say: "Now Antigravity, Cursor, Aider, and Claude Code all share this brain. One install. Cross-platform. Done."

---

## 9. Out of Scope (intentionally, for 9 hours)

- **No multi-user / cloud sync.** Local-only Atlas connection per user. No accounts.
- **No fine-tuning.** Stock Gemini embedding model.
- **No GPU local embedding fallback.** Atlas + Gemini API is the only path.
- **No file-watcher daemon.** Re-index is manual or triggered on workspace switch. (Stretch goal: `watchdog` integration in the sidecar.)
- **No code-symbol awareness.** Embeddings are file-level, not function-level. (Stretch: chunk + embed by AST node.)

---

## 10. Build / Run

The engine + FastAPI server + Tauri shell are already wired up. See [README.md](README.md). The redesign work for the hackathon is:

1. **Chat panel rewrite** — replace the current 72×72 hover bubble in [front_end/desktop/public/](front_end/desktop/public/) with a 480×720 chat-and-canvas layout. Vanilla JS + Tailwind via CDN; no build step.
2. **SSE streaming** — add `/api/chat/stream` and `/api/index/stream` to [front_end/server.py](front_end/server.py).
3. **Visualization layer** — Three.js + a UMAP projection job (`umap-learn`, runs on the sidecar) writing `~/.sift/umap.pkl`.
4. **Windows packaging** — add `windows-latest` to the existing GitHub Actions matrix; ship `python-3.12-embed-amd64.zip` inside `front_end/desktop/src-tauri/resources/python/`. Update [front_end/desktop/src-tauri/src/backend.rs](front_end/desktop/src-tauri/src/backend.rs) to prefer `Resources/python/python.exe` when present, falling back to system `python3`.
5. **Onboarding wizard** — a small modal in the WebView on first run; persists to `~/.sift/.env` (mac) or `%APPDATA%\Sift\.env` (Windows) via a Tauri command.

Each is a 60-90 minute slice. Four people × 9 hours covers all five with time for the demo rehearsal.

---

## 11. ADDENDUM: Indexing Performance Optimizations

**Instruction for AI Assistant:** The sequential indexing pipeline is too slow. Implement the following three optimizations in `indexer.py` and `database.py` to reduce indexing time from minutes to seconds.

#### Optimization 1: Concurrent API Calls (ThreadPoolExecutor)
Do not embed files one by one. The Gemini API and network I/O are the bottlenecks. Use Python's `concurrent.futures.ThreadPoolExecutor` to process files in parallel.

**Implementation Requirement:**
```python
import concurrent.futures

def process_and_embed_file(filepath):
    # 1. Extract content/bytes
    # 2. Get Git log
    # 3. Call Gemini Embedding API
    # 4. Return formatted dictionary
    pass

def process_directory_concurrently(filepaths):
    results = []
    # Use 10-20 workers depending on API rate limits
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_and_embed_file, fp): fp for fp in filepaths}
        for future in concurrent.futures.as_completed(futures):
            try:
                doc = future.result()
                if doc:
                    results.append(doc)
            except Exception as e:
                print(f"Failed to process {futures[future]}: {e}")
    return results
```

#### Optimization 2: Incremental Indexing (File Hashing)
Do not re-index files that haven't changed. We will calculate a quick MD5 or SHA-256 hash of the file contents and store it in MongoDB. 

**Implementation Requirement:**
1. In `indexer.py`, generate a hash for each file: `file_hash = hashlib.md5(raw_bytes).hexdigest()`
2. Before extracting text or calling Gemini, query MongoDB for the `filepath`.
3. If the document exists AND the stored `file_hash` matches the current `file_hash`, **skip the file completely**.
4. Only call the Gemini API for new files or files where the hash has changed.

*Schema Update:* Add `"file_hash": "a1b2c3d4..."` to the MongoDB document schema.

#### Optimization 3: Bulk Database Upserts
Do not make a network request to MongoDB for every single file insertion. Batch the database operations.

**Implementation Requirement:**
In `database.py`, replace `collection.update_one()` inside a loop with `collection.bulk_write()`.

```python
from pymongo import UpdateOne

def bulk_upsert_documents(documents):
    if not documents:
        return
    
    operations = [
        UpdateOne(
            {"filepath": doc["filepath"]}, 
            {"$set": doc}, 
            upsert=True
        ) for doc in documents
    ]
    
    collection.bulk_write(operations)
```

#### Optimization 4: Strict File Filtering & Truncation
1. **Exclude large binaries:** Ignore `.mp4`, `.zip`, `.csv`, `.tar.gz`, `.min.js`, `package-lock.json`.
2. **Truncate long files:** Gemini has a context limit, and embeddings lose specificity on massive text blocks. Truncate text files to the first `10,000` characters before sending them to the embedding model.

*** 

### How to test this during the Hackathon
1. **Run 1 (Cold Start):** Run the indexer on a repo with ~100 files. It should take about 15-30 seconds (processing 10 at a time).
2. **Run 2 (Warm Start):** Run the indexer *again* without changing anything. It should finish in `< 1 second` because the hashing logic will skip every file.
3. **Run 3 (Modification):** Change exactly *one* file and run the indexer. It should finish in ~2 seconds (only making 1 API call).
