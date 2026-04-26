## Inspiration

Modern AI coding agents are **pixel-blind**. Cursor, Claude Code, Antigravity, and Aider all navigate codebases the same way with `grep` and `find`. That falls apart the moment a screenshot is named `IMG_9921.png`, a flowchart lives inside `whiteboard_v3.pdf`, or a teammate asks "where's the auth diagram?"

We've all hoarded the same junk. There are files like `download (1).jpeg`, `screenshot_449.png`, `IMG_9912.jpg`, undocumented scripts, and PDFs nobody opened twice. Existing agents can write code but they can't *see* the workspace they live in. The second you ask one to organize files, the local vector database it relied on breaks because no one is keeping the index in sync with disk.

We wanted to give every agent a multimodal semantic memory of the repo. It needed to survive file moves, and it had to understand what's drawn on a whiteboard photo, and it had to work from a single install.

## What it does

**Nebula** is a cross-platform Tauri desktop app for multimodal semantic file search and chat-driven file organization.

- **Index any folder.** Code, text, Markdown, PDFs, and images are embedded with Google's `gemini-embedding-2-preview` (768 dims) and stored in MongoDB Atlas Vector Search.
- **Search by meaning.** "find the architecture diagram" returns `IMG_9921.png` because Gemini *looked at the pixels*, and no one tagged it.
- **3D constellation view.** Every indexed file is a star. Stars are MIME-colored and clustered by semantic similarity in a Three.js scene. Type a query and the camera flies to the matching cluster while hits light up.
- **Agentic file ops.** A LangGraph agent powered by Gemini 2.5 Flash can `semantic_file_search`, `ask_about_files` (multimodal Q&A on local PDFs/images), preview a plan, execute moves/renames/trash, and `undo_last_action`. Everything is gated by a confirm step before anything destructive runs.
- **Self-healing vector state.** When the agent moves or renames a file, it `$set`s the new `filepath` on the existing Mongo document. Embeddings stay valid, and there is no re-indexing.
- **Augments other agents.** One click drops a `.cursorrules` / `.antigravity_rules` / `AGENTS.md` / `.aider.conf.yml` into the workspace. These files point every popular agent at Nebula's localhost API.

## How we built it

There are three independent layers, and each one is runnable on its own:

1. **Backend library (Python).** `input_to_embedding.py` branches on MIME. Text-like files use Gemini's `text` field, and images and PDFs go via `Part.from_bytes`. `query_elements.py` runs an Atlas `$vectorSearch` aggregation with cosine similarity and a score-gap filter so weak matches stay hidden. `agent.py` wires LangGraph onto Gemini 2.5 Flash with seven registered tools.
2. **FastAPI server.** It wraps the backend over HTTP with `/api/chat`, `/api/semantic/search`, `/api/projection` (PCA into 2D for the constellation), `/api/file/preview` (text/image/PDF as base64), and `/api/index/stream` (SSE that emits per-file `discovered`, `loaded`, `embed`, `atlas-insert`, and `done` events). All filesystem access is gated by `_safe_resolve_under_roots()` against `NEBULA_FS_ROOT`.
3. **Tauri 2 desktop shell.** A Rust sidecar boots `uvicorn` on `127.0.0.1:8765` on launch and kills it on exit. The UI is React + Three.js loaded from CDN with no build step. `constellation.jsx` owns the 3D scene (raycaster hover/click, nebula gradients, cartesian grid), `ui.jsx` holds every panel (chat drawer, preview pane, mini-map, pipeline bar, settings), and `backend.jsx` is the data adapter.

**Stack:** Google Gemini (`gemini-embedding-2-preview` + `gemini-2.5-flash`), MongoDB Atlas Vector Search (768-dim, cosine, filter on `file_type`), LangGraph, FastAPI, uvicorn, Tauri 2, Rust, React, Three.js, and `send2trash`.

## Challenges we ran into

- **Atlas ANN noise across projects.** With only a few hundred docs split across many `project_id`s, the approximate-nearest-neighbor pipeline was dominated by noise from unrelated projects, and files matching the query never made it past the ANN cut. We rewrote project-scoped search to pull the project's vectors and run exact in-memory cosine in NumPy. The agent went from "I couldn't find any files containing python" to returning the right hits in one round-trip.
- **State plumbing between the constellation and the search results.** The 3D view stored `projectRoot` as a folder path while the API expected a project ID, so every projection call failed silently. Search hits that didn't have a corresponding constellation node also vanished from the UI, so we added synthetic negative-id nodes and a `selectedNodeOverride` so any hit could open the preview pane.
- **Tauri sidecar lifecycle on Windows.** `python3` on Windows resolves to a Microsoft Store stub. `dev.sh` had to whitelist `/c/Python31x/python` paths and skip `WindowsApps` entries, and the packaged build had to fall back to a bundled `python-3.12-embed-amd64` when system Python was missing.
- **Pinned vector dimensionality.** The Atlas index is hard-coded to 768 dims. Switching embedding models means dropping and recreating the index, and we learned that the hard way.
- **Sequential indexing was too slow.** A 100-file repo took minutes because every file did a synchronous Gemini round-trip plus a Mongo insert. We designed (and partially landed) a `ThreadPoolExecutor` + content-hash + `bulk_write` pipeline to bring that under 30 seconds.

## Accomplishments that we're proud of

- An end-to-end multimodal pipeline. Drag a folder in, watch ~90 files stream through `loaded`, `embed`, and `atlas-insert` on a live SSE pipeline view, and then *see* them cluster by meaning in 3D.
- The "wow" demo lands. Ask "find the auth diagram," and the camera flies to a whiteboard photo named `IMG_9921.png` with a 0.91 score, because Gemini understood the pixels.
- A LangGraph agent with **atomic, reversible** filesystem operations. Every `execute_plan` and `trash_file` records an undo batch, and you can replay it LIFO.
- A **self-healing index**. The agent's file moves `$set` the new path on the existing Mongo doc, so embeddings never go stale.
- One-file IDE integration. The same backend serves Cursor, Antigravity, Claude Code, and Aider via a localhost rules drop. Nebula doesn't replace anyone, and it augments everyone.

## What we learned

- `$vectorSearch` is registered with `create_search_index`, but the actual matching only happens when you `aggregate(pipeline)`. The index can show "READY" and still return `[]` for several minutes while warming.
- ANN at small scale is noisier than people expect. Below a few thousand vectors per project, exact cosine in NumPy is faster *and* more accurate than a tuned `numCandidates`.
- Multimodal Gemini embeddings genuinely collapse text, images, and PDFs into the same space. A photo of a whiteboard and a Markdown doc describing it actually land near each other, and that's not a marketing claim. It's a stage demo.
- Tauri 2's sidecar model is great for the happy path and brutal at the edges. Window lifecycle, port readiness probes, and Python discovery are real cross-platform engineering, and they are not config.
- Score-gap filtering matters more than score thresholds. The right answer isn't "drop everything below 0.65," and it's "drop everything past the largest score gap." That's what makes the result list feel sharp.

## What's next for Nebula

- **Streaming chat tokens.** Currently the agent returns a full JSON response, so we want to SSE-stream the tokens so they appear character-by-character with inline tool-call chips.
- **Score Waterfall visualization.** A horizontal bar chart of hit scores with the gap threshold drawn as a dashed line will make the heuristic visible.
- **Indexing performance pass.** We will land the planned `ThreadPoolExecutor` (10 workers) plus per-file content hash plus `collection.bulk_write` upserts. The goal is to cold-start a 100-file repo in under 30s, and warm-start in under 1s.
- **File-watcher daemon.** `watchdog` integration so re-indexing happens automatically instead of on demand.
- **Symbol-level chunking.** Right now embeddings are file-level. Chunking by AST node would let the agent find a specific function, and not just the file it lives in.
- **Windows packaging.** We will add `windows-latest` to the GitHub Actions matrix and ship `.msi` + `.exe` alongside the `.dmg`, with the embedded Python runtime baked into Resources.
- **Onboarding wizard.** A first-run modal that captures `GEMINI_API_KEY` + `MONGO_URI`, pings each, and seeds a 5-second starter constellation so the visualization is never empty on first open.
