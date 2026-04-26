Here is the updated, final `design.md` specification. It includes the headless architecture, explicitly targets **Antigravity** as the primary demonstration environment, and includes the exact technical instructions for solving the "Pixel Blind" image problem.

***

# Sift: Headless Semantic Codebase Engine for Antigravity & Agentic IDEs
**Hackathon Design & Implementation Specification**

## 1. System Overview
Sift is a local, AI-powered semantic search engine designed to supercharge agentic IDEs and tools like **Antigravity**, Cursor, and Aider. 

**The Problem (The "Pixel Blind" Flaw):** Currently, AI coding agents rely on traditional keyword search (`grep`, `rg`) to locate context. They fail completely when files have opaque names (e.g., `screenshot_2024_03.png`) or when the semantic intent of a query doesn't match literal code tokens. AI agents cannot "read" pixels via `grep`.
**The Solution:** Sift indexes a local directory (code, PDFs, images), enriches files with Git history, embeds them using **Gemini's Multimodal capabilities**, and stores them in MongoDB Atlas. Because text and images are mapped into the same mathematical space, Sift allows Antigravity to instantly find a file named `capture1.png` when queried for an "architecture diagram". Sift exposes this semantic brain directly to the agent via a CLI tool and an OpenAPI spec.

**Scope Note for AI Assistant:** This is a 9-hour hackathon build. Prioritize building the FastAPI backend, the multimodal embedding pipeline, and the Python CLI integration. The web frontend is strictly optional. Do not implement authentication. 

---

## 2. Tech Stack
*   **Core Engine Backend:** Python 3.11+, FastAPI, Uvicorn.
*   **CLI Interface:** `Typer` (or standard `argparse`), `requests`.
*   **Database:** MongoDB Atlas (M0 Free Tier) with Vector Search.
*   **AI/LLM:** `google-generativeai` SDK.
    *   *Embeddings:* Use `gemini-embedding-2-preview` (for native multimodal embedding if available) OR use `gemini-1.5-flash` to generate dense visual descriptions of images, which are then embedded using `models/text-embedding-004`.
*   **File Processing:** `PyMuPDF` (PDFs), `gitpython` (Git logs), `python-magic` or standard `mimetypes`.

---

## 3. Database Architecture (MongoDB Atlas)

### 3.1 Document Schema (`sift.files`)
```json
{
  "_id": "ObjectId",
  "filepath": "/absolute/path/to/repo/docs/capture1.png",
  "filename": "capture1.png",
  "filetype": "image/png",
  "snippet": "[Image Description or Code Snippet] This is a flowchart showing the auth architecture...", 
  "git_log": ["docs: add auth whiteboard screenshot"],
  "embedding": [0.012, -0.044, ...], 
  "indexed_at": "2024-04-26T12:00:00Z"
}
```

### 3.2 Atlas Vector Search Index Definition
*Must be created manually in the Atlas UI or via Atlas Admin API before searching.*
**Index Name:** `vector_index`
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}
```

---

## 4. IDE Integration Strategy (Antigravity & CLI)

To make Sift available to Antigravity (and other agents), we use a Universal CLI Tool combined with a System Prompt override.

### 4.1 The Universal CLI Tool (`sift_cli.py`)
Agents are highly adept at executing terminal commands and parsing JSON outputs from `stdout`. We will build a lightweight Python script that accepts a natural language string, hits the FastAPI search endpoint, and outputs strictly formatted JSON. 

### 4.2 The Prompt Injection (Antigravity Rules)
We place a configuration file (e.g., `.cursorrules`, `.antigravity_rules`, or inject it into Antigravity's system prompt) in the target repository to override the agent's default behavior.

**Implementation Requirement - Rules Template:**
```text
You are an expert developer assistant inside Antigravity. 
When you need to find a file, understand the architecture, look for diagrams, or find context, DO NOT use `grep`, `find`, or standard file search. 
Instead, use the local semantic search engine called Sift, which can see inside images and understand code intent.
Run the terminal command: `python sift_cli.py search "your natural language query"`
Read the JSON output from this command to find the correct file paths, image descriptions, and code snippets before you start writing code.
```

---

## 5. Backend API Specification (FastAPI Engine)

### 5.1 Endpoints
*   **`POST /api/index`**
    *   *Payload:* `{"directory_path": "/Users/dev/my_project"}`
    *   *Action:* Triggers the directory crawl, git-log extraction, multimodal embedding, and DB upsert.
*   **`GET /api/search`**
    *   *Params:* `?q=auth architecture diagram&k=5`
    *   *Action:* Embeds `q`, runs MongoDB `$vectorSearch`.
    *   *Response:* `[{"filepath": "...", "snippet": "...", "score": 0.92, "filetype": "..."}]`
*   **`GET /api/file`**
    *   *Params:* `?filepath=/path/to/file.py`

### 5.2 Core Python Modules
1.  **`indexer.py`**:
    *   `walk_directory(path)` -> yields valid file paths. Ignore `node_modules`, `.venv`, `.git`.
    *   `extract_content(filepath)` -> extracts text for code. For images (`.png`, `.jpg`), reads raw bytes.
    *   `get_git_context(filepath)` -> uses `gitpython` to get the last 3 commit messages for the file to enrich the embedding.
2.  **`embedding.py`**:
    *   `get_embedding(text=None, image_bytes=None)` -> Calls Gemini API. 
    *   *Crucial Hackathon Fallback:* If native multimodal embeddings throw API errors, immediately fallback to: Pass `image_bytes` to `gemini-1.5-flash` with the prompt "Describe this architecture diagram or screenshot in high technical detail", then embed the resulting text.
3.  **`database.py`**:
    *   `upsert_document(doc)` -> Inserts/updates by `filepath`.
    *   `vector_search(query_vector, k)` -> Runs `$vectorSearch` pipeline.
4.  **`sift_cli.py`** *(The CLI Entrypoint)*:
    *   Commands: `python sift_cli.py index <path>` and `python sift_cli.py search "<query>"`.

---

## 6. AI Implementation Steps (Execution Plan)

*AI Assistant: Follow these steps sequentially. This prioritizes the headless/CLI approach and the multimodal image feature for the Antigravity demonstration.*

**Phase 1: Backend Scaffolding & DB (Hours 1-2)**
1. Initialize Python environment (`fastapi`, `uvicorn`, `pymongo`, `google-generativeai`, `gitpython`, `pymupdf`, `requests`).
2. Create `database.py`. Connect to MongoDB via `MONGO_URI`. Write the `$vectorSearch` pipeline function.
3. Create `embedding.py`. Setup the Gemini SDK. Implement the text-to-vector and image-to-vector logic.

**Phase 2: The Indexer & Endpoints (Hours 2-4)**
1. Write `indexer.py`. Implement local directory traversal, skipping standard ignore targets.
2. Implement `gitpython` logic to fetch commit messages.
3. Wire the indexer to the MongoDB upsert function. Ensure images are processed correctly.
4. Create the FastAPI app (`main.py`). Implement `POST /api/index`, `GET /api/search`, and `GET /api/file`.

**Phase 3: The CLI Integration (Hours 4-5)**
1. Create `sift_cli.py` using standard `argparse` or `sys.argv`.
2. Implement the `index` command (hits `POST /api/index`).
3. Implement the `search` command (hits `GET /api/search` and outputs clean JSON to `stdout`).

**Phase 4: Antigravity Demo Prep & Testing (Hours 5-7)**
1. Start the FastAPI server (`uvicorn main:app --reload`).
2. Create a `demo_repo` folder. Add a few code files. **Crucially: Add a screenshot of a whiteboard or architecture diagram and name it something opaque like `IMG_9921.png`.**
3. Add the System Prompt / Rules file to the repo.
4. Use the CLI to index the `demo_repo`.
5. **The Climax Test:** Open the repo in Antigravity. Ask Antigravity: *"Find the architecture diagram."* Verify Antigravity reads the rules, executes `python sift_cli.py search "architecture diagram"`, parses the JSON, and successfully identifies `IMG_9921.png` based purely on its semantic pixel content.

**Phase 5: Polish (Hours 7-9)**
1. Refine the MongoDB vector search (tune the `k` value and score threshold).
2. Ensure the CLI output is concise to avoid blowing up Antigravity's context window. Handle errors gracefully (e.g., if FastAPI is down, print a helpful terminal error so the agent knows what went wrong).