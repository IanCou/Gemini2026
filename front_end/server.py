"""
FastAPI backend for the CopperGolem Tauri desktop UI.

Wraps the existing nebula_s26/backend/ agent and vector-search modules
without modifying them. Run from the front_end directory:

    python -m uvicorn server:app --host 127.0.0.1 --port 8765
"""

from __future__ import annotations

import base64
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Bootstrap: load .env, then put backend/ on sys.path so its imports resolve.
# ---------------------------------------------------------------------------

from env_bootstrap import load_project_env

load_project_env()

_REPO_ROOT = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _REPO_ROOT / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Lazy imports for the backend.  input_to_embedding.py creates a Gemini
# client at *module level*, so importing the agent chain at top-level
# crashes the whole server when GEMINI_API_KEY is missing.  By deferring,
# health / session / browse / preview still work; the agent fails only on
# endpoints that actually need it.
# ---------------------------------------------------------------------------

_agent_mod = None


def _import_agent():
    global _agent_mod
    if _agent_mod is None:
        import agent as _mod  # noqa: E402

        _agent_mod = _mod
    return _agent_mod


def _langchain_messages():
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

    return AIMessage, HumanMessage, SystemMessage, ToolMessage


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

_sessions: dict[str, list] = {}
_graph = None

MAX_PREVIEW_BYTES = 20 * 1024 * 1024  # 20 MiB (images, text, etc.)
MAX_PDF_PREVIEW_BYTES = 40 * 1024 * 1024

app = FastAPI(title="CopperGolem API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_graph():
    global _graph
    if _graph is None:
        os.environ.setdefault("NEBULA_FS_ROOT", str(_REPO_ROOT.resolve()))
        mod = _import_agent()
        _graph = mod.create_chat_app()
    return _graph


def _content_roots() -> list[Path]:
    roots: list[Path] = []
    repo = _REPO_ROOT.resolve()
    roots.append(repo)

    if not (os.environ.get("COPPERGOLEM_NO_PARENT_ROOT") or "").strip():
        parent = repo.parent
        if parent.is_dir() and parent.resolve() not in roots:
            roots.append(parent.resolve())

    extra = os.environ.get("COPPERGOLEM_EXTRA_ROOTS", "")
    for token in re.split(r"[|;:]", extra):
        raw = token.strip()
        if not raw:
            continue
        p = Path(raw).expanduser().resolve()
        if p.is_dir() and p not in roots:
            roots.append(p)

    return roots


def _safe_resolve_under_roots(rel: str) -> Path:
    rel_norm = (rel or "").strip().replace("\\", "/").lstrip("/")
    if rel_norm in ("", "."):
        return _REPO_ROOT.resolve()
    if any(part == ".." for part in rel_norm.split("/")):
        raise HTTPException(status_code=400, detail="Invalid path")

    candidates: list[tuple[Path, Path]] = []
    for root in _content_roots():
        r = root.resolve()
        full = (r / rel_norm).resolve()
        try:
            full.relative_to(r)
        except ValueError:
            continue
        candidates.append((full, r))

    if not candidates:
        raise HTTPException(
            status_code=403,
            detail="Path outside allowed workspace roots",
        ) from None

    existing = [(f, rt) for f, rt in candidates if f.exists()]
    pick_from = existing if existing else candidates
    pick_from.sort(key=lambda fr: len(str(fr[1])), reverse=True)
    return pick_from[0][0]


def _rel_for_api(p: Path) -> str:
    pr = p.resolve()
    roots = sorted(_content_roots(), key=lambda r: len(str(r.resolve())), reverse=True)
    for root in roots:
        try:
            return str(pr.relative_to(root.resolve())).replace("\\", "/")
        except ValueError:
            continue
    return str(pr)


def _path_allowed(p: Path) -> bool:
    pr = p.resolve()
    for root in _content_roots():
        r = root.resolve()
        try:
            pr.relative_to(r)
            return True
        except ValueError:
            continue
    return False


# ---------------------------------------------------------------------------
# Chat models
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str = Field(..., min_length=1)
    project_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    found_files: list[str] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    is_plan_proposal: bool = Field(
        default=False,
        description="True when the agent previewed a plan (dry_run) and awaits user confirmation",
    )


# ---------------------------------------------------------------------------
# Parse tool results from message history
# ---------------------------------------------------------------------------

_FOUND_PATH_RE = re.compile(r"^\s+path:\s+(.+)$", re.MULTILINE)
_FOUND_FILE_RE_WITH_ID = re.compile(
    r"^\s*\d+\.\s+score=[\d.]+\s+\|\s+_id=\S+\s+\|\s+(.+?)\s+\|", re.MULTILINE
)
_FOUND_FILE_RE_LEGACY = re.compile(
    r"^\s*\d+\.\s+score=[\d.]+\s+\|\s+(.+?)\s+\|", re.MULTILINE
)


def _messages_after_last_human(messages: list) -> list:
    AIMessage, HumanMessage, SystemMessage, ToolMessage = _langchain_messages()
    last_human_idx = -1
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], HumanMessage):
            last_human_idx = i
            break
    return messages[last_human_idx + 1 :] if last_human_idx >= 0 else messages


def extract_tools_used(messages: list) -> list[str]:
    AIMessage, HumanMessage, SystemMessage, ToolMessage = _langchain_messages()
    recent = _messages_after_last_human(messages)
    out: list[str] = []
    seen: set[str] = set()
    for m in recent:
        if not isinstance(m, ToolMessage):
            continue
        name = getattr(m, "name", None)
        if name and name not in seen:
            seen.add(name)
            out.append(str(name))
    return out


def extract_found_files(messages: list) -> list[str]:
    AIMessage, HumanMessage, SystemMessage, ToolMessage = _langchain_messages()
    recent = _messages_after_last_human(messages)

    out: list[str] = []
    seen: set[str] = set()
    for m in recent:
        if not isinstance(m, ToolMessage):
            continue
        content = m.content if isinstance(m.content, str) else str(m.content)
        if "score=" not in content:
            continue
        for mo in _FOUND_PATH_RE.finditer(content):
            p = mo.group(1).strip()
            if p and p not in seen:
                seen.add(p)
                out.append(p)
        if not out:
            for rx in (_FOUND_FILE_RE_WITH_ID, _FOUND_FILE_RE_LEGACY):
                for mo in rx.finditer(content):
                    fname = mo.group(1).strip()
                    if fname and fname not in seen:
                        seen.add(fname)
                        out.append(fname)
    return out


def _detect_plan_proposal(messages: list, tools_used: list[str]) -> bool:
    """Return True when the agent ran a plan preview (dry_run) but hasn't executed yet."""
    plan_tools = {"preview_plan", "execute_plan"}
    if not plan_tools.intersection(tools_used):
        return False
    AIMessage, HumanMessage, SystemMessage, ToolMessage = _langchain_messages()
    recent = _messages_after_last_human(messages)
    for m in recent:
        if not isinstance(m, ToolMessage):
            continue
        content = m.content if isinstance(m.content, str) else str(m.content)
        if "dry_run" in content.lower() or "Plan preview" in content:
            return True
        if "=== Execution ===" in content and "Done." in content:
            return False
    return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    mongo_ok = False
    try:
        from pymongo import MongoClient

        uri = os.environ.get("MONGO_URI", "")
        if uri:
            c = MongoClient(uri, serverSelectionTimeoutMS=3000)
            c.admin.command("ping")
            mongo_ok = True
    except Exception:
        pass
    return {
        "ok": True,
        "mongo": mongo_ok,
        "gemini_key_set": bool((os.environ.get("GEMINI_API_KEY") or "").strip()),
    }


@app.post("/api/session/new")
def new_session():
    sid = str(uuid.uuid4())
    _sessions[sid] = []
    return {"session_id": sid}


@app.get("/api/agent/tools")
def agent_tools():
    """Expose tool names/descriptions so the UI can show capabilities."""
    try:
        mod = _import_agent()
        tools_out: list[dict[str, str]] = []
        for t in mod.AGENT_TOOLS:
            desc = (getattr(t, "description", None) or "").strip()
            first_line = desc.split("\n", 1)[0].strip() if desc else ""
            tools_out.append({"name": getattr(t, "name", ""), "description": first_line})
        return {
            "tools": tools_out,
            "fs_root": os.environ.get("NEBULA_FS_ROOT", "") or str(_REPO_ROOT.resolve()),
            "system_prompt": getattr(mod, "DEFAULT_AGENT_SYSTEM", ""),
        }
    except Exception:
        return {
            "tools": [
                {"name": "semantic_file_search", "description": "Search files by meaning (vector similarity)"},
                {"name": "preview_plan", "description": "Preview a file-management plan without executing"},
                {"name": "execute_plan", "description": "Execute a file-management plan (create, move, remove, index)"},
                {"name": "undo_last_action", "description": "Undo the last executed plan"},
            ],
            "fs_root": os.environ.get("NEBULA_FS_ROOT", "") or str(_REPO_ROOT.resolve()),
            "system_prompt": "",
        }


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    AIMessage, HumanMessage, SystemMessage, ToolMessage = _langchain_messages()
    mod = _import_agent()

    if req.project_id:
        proj = _project_by_id(req.project_id)
        if proj:
            os.environ["NEBULA_FS_ROOT"] = proj["root"]
            os.environ["NEBULA_ACTIVE_PROJECT_ID"] = req.project_id
        else:
            os.environ.pop("NEBULA_ACTIVE_PROJECT_ID", None)
    else:
        os.environ.pop("NEBULA_ACTIVE_PROJECT_ID", None)

    sid = req.session_id or str(uuid.uuid4())
    if sid not in _sessions:
        _sessions[sid] = []

    messages = _sessions[sid]

    if not messages:
        base = getattr(mod, "DEFAULT_AGENT_SYSTEM", "") or ""
        sys_text = (
            base.strip()
            + "\n\nIMPORTANT RULES:"
            "\n1. When the user asks you to organize, move, rename, "
            "create, remove, or index files, ALWAYS call execute_plan with "
            "dry_run=True FIRST. Show the preview and ask the user to confirm "
            "before executing. Only call execute_plan with dry_run=False after "
            "the user explicitly confirms. Never execute destructive actions "
            "without confirmation."
            "\n2. For semantic_file_search: be VERY selective about results. "
            "Use k=3 when the user wants ONE specific file. Use k=8 for broader "
            "category searches. After getting results, CRITICALLY evaluate them: "
            "look at the scores and look for a SCORE GAP — a meaningful drop "
            "between consecutive results. Results that cluster near the top "
            "are likely relevant; results after a noticeable score drop are noise. "
            "For example if scores are 0.69, 0.68, 0.65, 0.64, 0.64 — the top 2 "
            "are clearly better and the rest are noise. ONLY report results that "
            "are genuinely relevant to the query. It is much better to return "
            "1-2 highly relevant files than 10 mediocre ones. If none of the "
            "scores are notably higher than the rest, tell the user nothing "
            "strongly matched."
        )
        messages.append(SystemMessage(content=sys_text))

    messages.append(HumanMessage(content=req.message.strip()))
    try:
        final = get_graph().invoke({"messages": messages})
    except Exception as e:
        messages.pop()
        raise HTTPException(status_code=500, detail=str(e)) from e

    messages[:] = final["messages"]
    reply = mod.last_assistant_reply(messages)
    found = extract_found_files(messages)
    used = extract_tools_used(messages)

    is_plan = _detect_plan_proposal(messages, used)

    return ChatResponse(
        session_id=sid,
        reply=reply or "(no text reply)",
        found_files=found,
        tools_used=used,
        is_plan_proposal=is_plan,
    )


# ---------------------------------------------------------------------------
# File browsing & preview
# ---------------------------------------------------------------------------


@app.get("/api/browse")
def browse(rel_path: str | None = Query(default=None)):
    effective = rel_path.strip().replace("\\", "/").lstrip("/") if rel_path else ""
    p = _safe_resolve_under_roots(effective)
    if not p.exists():
        return {"path": _rel_for_api(p), "entries": [], "missing": True}
    if p.is_file():
        return {"path": _rel_for_api(p), "entries": [], "is_file": True}
    entries = []
    for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        if child.name.startswith("."):
            continue
        if not _path_allowed(child):
            continue
        st = child.stat()
        entries.append(
            {
                "name": child.name,
                "path": _rel_for_api(child),
                "is_dir": child.is_dir(),
                "size": None if child.is_dir() else st.st_size,
            }
        )
    return {"path": _rel_for_api(p), "entries": entries}


def _find_file_by_name(filename: str) -> Path | None:
    """Walk content roots looking for *filename*. Searches extra roots first."""
    extra = os.environ.get("COPPERGOLEM_EXTRA_ROOTS", "")
    extra_paths = set()
    for token in re.split(r"[|;:]", extra):
        raw = token.strip()
        if raw:
            extra_paths.add(Path(raw).expanduser().resolve())

    roots = _content_roots()
    ordered = sorted(roots, key=lambda r: r.resolve() not in extra_paths)

    for root in ordered:
        for dirpath, dirs, files in os.walk(root.resolve()):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            if filename in files:
                candidate = Path(dirpath) / filename
                if candidate.is_file() and _path_allowed(candidate):
                    return candidate.resolve()
    return None


@app.get("/api/file/preview")
def file_preview(rel_path: str = Query(..., min_length=1)):
    raw = rel_path.strip()

    if os.path.isabs(raw):
        p = Path(raw).expanduser().resolve()
        if not _path_allowed(p) or not p.exists() or not p.is_file():
            resolved = None
            parts = Path(raw).parts[1:]
            for length in range(len(parts), 0, -1):
                candidate_rel = str(Path(*parts[-length:]))
                try:
                    candidate = _safe_resolve_under_roots(candidate_rel)
                    if candidate.exists() and candidate.is_file():
                        resolved = candidate
                        break
                except HTTPException:
                    continue
            if resolved is None:
                resolved = _find_file_by_name(p.name)
            if resolved is None:
                raise HTTPException(status_code=404, detail="File not found in any workspace root")
            p = resolved
    else:
        p = _safe_resolve_under_roots(raw)
        if not p.exists() or not p.is_file():
            fallback = _find_file_by_name(Path(raw).name)
            if fallback is None:
                raise HTTPException(status_code=404, detail="Not a file")
            p = fallback

    suffix = p.suffix.lower()
    size = p.stat().st_size
    limit = MAX_PDF_PREVIEW_BYTES if suffix == ".pdf" else MAX_PREVIEW_BYTES
    if size > limit:
        raise HTTPException(
            status_code=413,
            detail=f"File too large for preview ({size} bytes; max {limit})",
        )
    data = p.read_bytes()
    display_path = raw

    image_mimes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }
    if suffix == ".pdf":
        return {
            "kind": "pdf",
            "mime": "application/pdf",
            "content": base64.b64encode(data).decode("ascii"),
            "name": p.name,
            "path": display_path,
            "size": size,
        }
    if suffix in image_mimes:
        return {
            "kind": "image",
            "mime": image_mimes[suffix],
            "content": base64.b64encode(data).decode("ascii"),
            "name": p.name,
            "path": display_path,
            "size": size,
        }
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
    printable_ratio = sum(
        1 for c in text[:8000] if c.isprintable() or c in "\n\r\t"
    ) / max(min(len(text), 8000), 1)
    if printable_ratio < 0.85 and size > 256:
        return {
            "kind": "binary",
            "name": p.name,
            "path": display_path,
            "size": size,
            "message": "File looks binary; preview supports text, images, and PDF.",
        }
    return {
        "kind": "text",
        "content": text,
        "name": p.name,
        "path": display_path,
        "size": size,
    }


class FileOpenBody(BaseModel):
    rel_path: str = Field(..., min_length=1)


@app.post("/api/file/open")
def file_open(body: FileOpenBody):
    """Open a file in the OS-default application."""
    import subprocess
    import sys as _sys

    raw = body.rel_path.strip()
    if os.path.isabs(raw):
        p = Path(raw).expanduser().resolve()
    else:
        p = _safe_resolve_under_roots(raw)
    if not p.exists():
        fallback = _find_file_by_name(Path(raw).name)
        if fallback is None:
            raise HTTPException(status_code=404, detail="File not found")
        p = fallback
    if not _path_allowed(p) and not p.is_absolute():
        raise HTTPException(status_code=403, detail="Path outside allowed roots")

    try:
        if _sys.platform == "darwin":
            subprocess.Popen(["open", str(p)])
        elif _sys.platform.startswith("win"):
            os.startfile(str(p))  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", str(p)])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open: {e}") from e
    return {"ok": True, "path": str(p)}


# ---------------------------------------------------------------------------
# Semantic search HTTP endpoints (direct access, independent of chat)
# ---------------------------------------------------------------------------


def _filter_by_score_gap(results: list[tuple[dict, float]], min_score: float = 0.60) -> list[tuple[dict, float]]:
    """Keep only results above *min_score* that sit above the largest score gap."""
    above = [(doc, s) for doc, s in results if s >= min_score]
    if len(above) <= 1:
        return above

    gaps = []
    for i in range(len(above) - 1):
        gaps.append((above[i][1] - above[i + 1][1], i))

    max_gap, gap_idx = max(gaps, key=lambda g: g[0])
    median_gap = sorted(g for g, _ in gaps)[len(gaps) // 2]

    if max_gap > median_gap * 2.5 and max_gap > 0.008:
        return above[: gap_idx + 1]

    return above


@app.get("/api/semantic/search")
def semantic_search(
    q: str = Query(..., min_length=1),
    k: int = Query(default=15, ge=1, le=50),
    min_score: float = Query(default=0.60, ge=0.0, le=1.0),
    project: str = Query(default=""),
):
    try:
        from query_elements import similarity_search_with_score
    except ImportError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    pid = project.strip() or None
    # Pull more candidates so post-filter still has a useful k.
    fetch_k = k * 5 if pid else k
    fetch_k = min(max(fetch_k, k), 100)
    try:
        results = similarity_search_with_score(q, k=fetch_k, project_id=pid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    results = results[:k]

    filtered = _filter_by_score_gap(results, min_score=min_score)

    hits = []
    for doc, score in filtered:
        hits.append(
            {
                "filename": doc.get("filename"),
                "filepath": doc.get("filepath"),
                "file_type": doc.get("file_type"),
                "score": round(score, 4),
            }
        )
    return {"query": q, "hits": hits}


class SemanticIndexBody(BaseModel):
    file_path: str = Field(..., min_length=1)
    description: str = ""


@app.post("/api/semantic/index")
def semantic_index(body: SemanticIndexBody):
    try:
        from add_element import ingest_file_to_db
    except ImportError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    p = Path(body.file_path).expanduser().resolve()
    if not p.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {p}")
    if not _path_allowed(p):
        raise HTTPException(status_code=403, detail="File path outside allowed workspace roots")
    try:
        ingest_file_to_db(str(p), body.description or None)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"ok": True, "message": f"Indexed: {p.name}"}


_INDEX_EXTENSIONS = frozenset(
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".txt", ".md", ".webp", ".gif",
        ".py", ".pyi", ".ipynb", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
        ".html", ".css", ".rs", ".c", ".cpp", ".h", ".hpp", ".java", ".go", ".sh", ".rb", ".php",
        ".swift", ".kt", ".kts", ".dart", ".json", ".yaml", ".yml", ".toml", ".sql", ".mdx",
        ".gradle", ".maven", ".xml"
    }
)

_IGNORE_DIRS = {
    ".git", "node_modules", "venv", ".venv", "__pycache__",
    "target", "dist", "build", "demo_repo", ".next", ".tauri",
    "node_modules", ".DS_Store", "scratch"
}


class IndexDirectoryBody(BaseModel):
    rel_path: str = Field(..., min_length=1)


@app.post("/api/semantic/index_directory")
def semantic_index_directory(body: IndexDirectoryBody):
    try:
        from add_element import ingest_file_to_db
    except ImportError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    s = body.rel_path.strip()
    if os.path.isabs(s):
        root = Path(s).expanduser().resolve()
        if not root.is_dir():
            raise HTTPException(status_code=400, detail=f"Not a directory: {root}")
        if not _path_allowed(root):
            raise HTTPException(status_code=403, detail="Folder outside allowed roots.")
    else:
        root = _safe_resolve_under_roots(s)

    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")

    indexed = 0
    scanned_files = 0
    errors: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        # Prune hidden and ignored directories
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in _IGNORE_DIRS]
        for name in filenames:
            if name.startswith(".") or name in _IGNORE_DIRS:
                continue
            scanned_files += 1
            suf = Path(name).suffix.lower()
            if suf not in _INDEX_EXTENSIONS:
                continue
            fp = Path(dirpath) / name
            if not _path_allowed(fp):
                continue
            try:
                ingest_file_to_db(str(fp.resolve()), None)
                indexed += 1
            except Exception as e:
                errors.append(f"{fp.name}: {e}")

    return {
        "ok": True,
        "indexed": indexed,
        "scanned_files": scanned_files,
        "root_api": _rel_for_api(root),
        "resolved_absolute": str(root.resolve()),
        "errors": errors[:25],
    }


@app.get("/api/workspace/roots")
def workspace_roots():
    return {"roots": [str(r) for r in _content_roots()]}


# ---------------------------------------------------------------------------
# SSE: live indexing pipeline (drives the Pipeline View visualization)
# ---------------------------------------------------------------------------


def _sse(event: str, data: dict) -> str:
    import json as _json
    return f"event: {event}\ndata: {_json.dumps(data)}\n\n"


@app.get("/api/index/stream")
def index_stream(
    rel_path: str = Query(default="", description="Optional folder; defaults to project root"),
    project: str = Query(default="", description="Project id; tags every doc with project_id and uses its root"),
):
    """Index a directory, streaming per-file pipeline stages as SSE events.

    Event types: start, stage (file, stage in {loaded,embed,insert,done,error}), end.
    If `project` is set, files are scanned under the project's stored root (rel_path is treated as a
    relative subpath under it) and tagged with `project_id` in MongoDB.
    """
    from fastapi.responses import StreamingResponse

    try:
        import add_element  # noqa: F401
    except ImportError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    pid = project.strip() or None
    proj = _project_by_id(pid) if pid else None
    if pid and not proj:
        raise HTTPException(status_code=404, detail=f"Project not found: {pid}")

    s = rel_path.strip()
    # Expand ~ so /index ~/anywhere works without a project.
    if s.startswith("~"):
        s = str(Path(s).expanduser())
    if proj:
        proj_root = Path(proj["root"]).expanduser().resolve()
        if not proj_root.is_dir():
            raise HTTPException(status_code=400, detail=f"Project root missing: {proj_root}")
        root = (proj_root / s).resolve() if s and not os.path.isabs(s) else (Path(s).expanduser().resolve() if s else proj_root)
        try:
            root.relative_to(proj_root)
        except ValueError as e:
            raise HTTPException(status_code=403, detail="Path outside project root.") from e
    else:
        if not s:
            raise HTTPException(status_code=400, detail="rel_path required when no project is set")
        if os.path.isabs(s):
            # User-picked absolute paths (via Finder dialog or /index /abs) are allowed
            # outside NEBULA_FS_ROOT — they're explicit; no chance of accidental escape.
            root = Path(s).expanduser().resolve()
        else:
            root = _safe_resolve_under_roots(s)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {root}")

    def gen():
        from add_element import ingest_file_to_db as _ingest, collection as _coll
        from bson.objectid import ObjectId as _OID
        files: list[Path] = []
        for dirpath, dirnames, filenames in os.walk(root, topdown=True):
            # Prune hidden and ignored directories
            dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in _IGNORE_DIRS]
            for name in filenames:
                if name.startswith(".") or name in _IGNORE_DIRS:
                    continue
                if Path(name).suffix.lower() not in _INDEX_EXTENSIONS:
                    continue
                fp = Path(dirpath) / name
                # Project-scoped indexing: skip the global path-allowed check.
                if proj or _path_allowed(fp):
                    files.append(fp.resolve())
        yield _sse("start", {"root": str(root), "total": len(files), "project": pid})
        for fp in files:
            yield _sse("stage", {"file": fp.name, "path": str(fp), "stage": "loaded"})
            try:
                yield _sse("stage", {"file": fp.name, "path": str(fp), "stage": "embed"})
                oid = _ingest(str(fp), None)
                if oid is None:
                    yield _sse("stage", {"file": fp.name, "path": str(fp), "stage": "error", "error": "embed_failed"})
                    continue
                if pid:
                    try:
                        _coll.update_one({"_id": _OID(str(oid))}, {"$set": {"project_id": pid}})
                    except Exception:
                        pass
                yield _sse("stage", {"file": fp.name, "path": str(fp), "stage": "insert"})
                yield _sse("stage", {"file": fp.name, "path": str(fp), "stage": "done", "oid": str(oid)})
            except Exception as e:
                yield _sse("stage", {"file": fp.name, "path": str(fp), "stage": "error", "error": str(e)[:200]})
        yield _sse("end", {"root": str(root), "total": len(files), "project": pid})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


# ---------------------------------------------------------------------------
# Projection: PCA over stored embeddings → 2-D coords for the Constellation View
# ---------------------------------------------------------------------------


@app.get("/api/projection")
def projection(query: str | None = Query(default=None), project: str = Query(default="")):
    """Return 2-D PCA coords for every indexed file. Optionally include the query embedding too."""
    try:
        from pymongo import MongoClient
        import numpy as np
    except ImportError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    uri = os.environ.get("MONGO_URI")
    if not uri:
        raise HTTPException(status_code=503, detail="MONGO_URI not set")
    coll = MongoClient(uri)["nebula"]["files"]
    pid = project.strip() or None
    flt = {"project_id": pid} if pid else {}
    docs = list(coll.find(flt, {"filename": 1, "filepath": 1, "file_type": 1, "embedding": 1, "project_id": 1}))
    if len(docs) < 2:
        return {"points": [], "query": None, "count": len(docs)}
    M = np.array([d["embedding"] for d in docs], dtype="float32")
    M = M - M.mean(axis=0, keepdims=True)
    U, S, Vt = np.linalg.svd(M, full_matrices=False)
    coords = (M @ Vt[:2].T)
    cx = coords - coords.mean(axis=0, keepdims=True)
    scale = float(np.max(np.abs(cx))) or 1.0
    cx = cx / scale
    points = [
        {
            "_id": str(d.get("_id")),
            "filename": d.get("filename"),
            "filepath": d.get("filepath"),
            "file_type": d.get("file_type"),
            "x": float(cx[i, 0]),
            "y": float(cx[i, 1]),
        }
        for i, d in enumerate(docs)
    ]
    qpoint = None
    if query and query.strip():
        try:
            from input_to_embedding import get_query_embedding
            qv = get_query_embedding(query.strip())
            if qv:
                q = np.array(qv, dtype="float32") - M.mean(axis=0, keepdims=True).flatten()
                qproj = (q @ Vt[:2].T) / scale
                qpoint = {"x": float(qproj[0]), "y": float(qproj[1]), "query": query.strip()}
        except Exception:
            pass
    return {"points": points, "query": qpoint, "count": len(docs)}


# ---------------------------------------------------------------------------
# Install agent rules into a workspace (the IDE-integration one-click)
# ---------------------------------------------------------------------------


_RULES_TEXT = """You have access to a local semantic search engine called Nebula, running on
http://127.0.0.1:8765. Nebula can see inside images and PDFs.

When you need to find a file, locate a diagram, understand the architecture,
or look for context, DO NOT use grep, find, or fuzzy file search first.
Instead, fetch:

  GET http://127.0.0.1:8765/api/semantic/search?q=<urlencoded>&k=5

Read the JSON `hits` array. Each hit has `filename`, `filepath`, `file_type`,
and `score`. Trust hits with score >= 0.65; ignore the rest. Open files via
`filepath`. Fall back to grep only if no hits clear the threshold.
"""


class InstallRulesBody(BaseModel):
    rel_path: str = Field(default="", description="Workspace folder; defaults to project root or NEBULA_FS_ROOT")
    project: str = Field(default="", description="Project id; if set, drops rules into the project's root")


@app.post("/api/install_rules")
def install_rules(body: InstallRulesBody):
    pid = (body.project or "").strip()
    raw = (body.rel_path or "").strip()
    if pid:
        proj = _project_by_id(pid)
        if not proj:
            raise HTTPException(status_code=404, detail=f"Project not found: {pid}")
        target = Path(proj["root"]).expanduser().resolve()
    elif raw:
        if os.path.isabs(raw):
            target = Path(raw).expanduser().resolve()
        else:
            target = _safe_resolve_under_roots(raw)
    else:
        target = _REPO_ROOT.resolve()
    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {target}")
    written: list[str] = []
    for fname in (".cursorrules", ".antigravity_rules", "AGENTS.md"):
        p = target / fname
        try:
            p.write_text(_RULES_TEXT, encoding="utf-8")
            written.append(str(p))
        except Exception as e:
            written.append(f"FAIL {p}: {e}")
    return {"ok": True, "target": str(target), "written": written}


# ---------------------------------------------------------------------------
# Stats (for the activity feed header)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Projects (Codex-style scoped workspaces, persisted to ~/.nebula/projects.json)
# ---------------------------------------------------------------------------


_PROJECTS_FILE = Path.home() / ".nebula" / "projects.json"


def _load_projects() -> list[dict[str, Any]]:
    try:
        if _PROJECTS_FILE.is_file():
            import json as _json
            return _json.loads(_PROJECTS_FILE.read_text())
    except Exception:
        pass
    return []


def _save_projects(projects: list[dict[str, Any]]) -> None:
    import json as _json
    _PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _PROJECTS_FILE.write_text(_json.dumps(projects, indent=2))


def _project_by_id(pid: str) -> dict[str, Any] | None:
    for p in _load_projects():
        if p.get("id") == pid:
            return p
    return None


@app.get("/api/projects")
def list_projects():
    """Return all projects + the doc count per project (live from MongoDB)."""
    projects = _load_projects()
    counts: dict[str, int] = {}
    try:
        from pymongo import MongoClient
        uri = os.environ.get("MONGO_URI", "")
        if uri:
            coll = MongoClient(uri, serverSelectionTimeoutMS=3000)["nebula"]["files"]
            for d in coll.aggregate([{"$group": {"_id": "$project_id", "n": {"$sum": 1}}}]):
                counts[str(d["_id"])] = d["n"]
    except Exception:
        pass
    for p in projects:
        p["count"] = counts.get(p.get("id", ""), 0)
    untagged = counts.get("None", 0) + counts.get("", 0)
    return {"projects": projects, "untagged": untagged}


class ProjectCreateBody(BaseModel):
    name: str = Field(..., min_length=1)
    root: str = Field(..., min_length=1)


@app.post("/api/projects")
def create_project(body: ProjectCreateBody):
    name = body.name.strip()
    root = Path(body.root).expanduser().resolve()
    if not root.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {root}")
    pid = uuid.uuid4().hex[:12]
    proj = {"id": pid, "name": name, "root": str(root)}
    projects = _load_projects()
    projects.append(proj)
    _save_projects(projects)
    return proj


@app.delete("/api/projects/{pid}")
def delete_project(pid: str, drop_data: bool = Query(default=False)):
    projects = _load_projects()
    keep = [p for p in projects if p.get("id") != pid]
    if len(keep) == len(projects):
        raise HTTPException(status_code=404, detail="Project not found")
    _save_projects(keep)
    deleted = 0
    if drop_data:
        try:
            from pymongo import MongoClient
            uri = os.environ.get("MONGO_URI", "")
            if uri:
                coll = MongoClient(uri)["nebula"]["files"]
                deleted = coll.delete_many({"project_id": pid}).deleted_count
        except Exception:
            pass
    return {"ok": True, "deleted_docs": deleted}


@app.get("/api/dialog/pick_folder")
def pick_folder():
    """Open a native folder picker (Finder on macOS, Explorer on Windows)."""
    import subprocess
    import sys as _sys
    try:
        if _sys.platform == "darwin":
            script = (
                'try\n'
                '  set f to POSIX path of (choose folder with prompt "Select project folder")\n'
                '  return f\n'
                'on error number -128\n'
                '  return ""\n'
                'end try'
            )
            r = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=120,
            )
            path = (r.stdout or "").strip()
            return {"path": path or None}
        if _sys.platform.startswith("win"):
            ps = (
                "Add-Type -AssemblyName System.Windows.Forms; "
                "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
                "if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }"
            )
            r = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                               capture_output=True, text=True, timeout=120)
            path = (r.stdout or "").strip()
            return {"path": path or None}
        # Linux fallback: zenity if installed
        r = subprocess.run(["zenity", "--file-selection", "--directory"],
                           capture_output=True, text=True, timeout=120)
        path = (r.stdout or "").strip()
        return {"path": path or None}
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"No native folder picker available: {e}") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/stats")
def stats(project: str = Query(default="")):
    try:
        from pymongo import MongoClient
        uri = os.environ.get("MONGO_URI", "")
        if not uri:
            return {"count": 0, "by_type": {}, "mongo": False}
        coll = MongoClient(uri, serverSelectionTimeoutMS=3000)["nebula"]["files"]
        pid = project.strip() or None
        flt = {"project_id": pid} if pid else {}
        n = coll.count_documents(flt)
        pipeline = [{"$match": flt}, {"$group": {"_id": "$file_type", "n": {"$sum": 1}}}] if flt \
            else [{"$group": {"_id": "$file_type", "n": {"$sum": 1}}}]
        by_type = {(d["_id"] or "?"): d["n"] for d in coll.aggregate(pipeline)}
        return {"count": n, "by_type": by_type, "mongo": True, "project": pid}
    except Exception as e:
        return {"count": 0, "by_type": {}, "mongo": False, "error": str(e)[:160]}


class ApiKeyBody(BaseModel):
    key: str = Field(..., min_length=1)


@app.post("/api/settings/apikey")
def save_apikey(body: ApiKeyBody):
    key = body.key.strip()
    env_path = _REPO_ROOT / ".env"
    lines: list[str] = []
    found = False
    if env_path.is_file():
        for line in env_path.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                lines.append(f"GEMINI_API_KEY={key}")
                found = True
            else:
                lines.append(line)
    if not found:
        lines.append(f"GEMINI_API_KEY={key}")
    env_path.write_text("\n".join(lines) + "\n")
    os.environ["GEMINI_API_KEY"] = key
    try:
        import input_to_embedding as _ite
        from google import genai as _genai
        _ite.client = _genai.Client(api_key=key)
    except Exception:
        pass
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8765, reload=False)
