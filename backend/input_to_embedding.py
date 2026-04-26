import os
import magic
from google import genai
from google.genai import types
from google.api_core import exceptions

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

_TEXT_MIMES = {
    "application/json", "application/xml", "application/x-yaml",
    "application/x-sh", "application/javascript", "application/typescript",
    "application/x-httpd-php", "application/sql", "application/toml",
    "application/wasm", "application/x-perl", "application/x-ruby",
    "application/x-swift", "application/x-kotlin", "application/x-python",
    "application/x-rust", "application/x-go",
}


def get_multimodal_embedding(file_path, description=None, task_type="RETRIEVAL_DOCUMENT"):
    """
    Embed a file for semantic search.

    Images and PDFs: `description` must carry the semantic content (AI caption
    or extracted text) — this function embeds it as pure text so it lands in
    the same space as text queries.  If description is absent, images fall back
    to raw bytes; PDFs fall back to raw bytes (search quality will be poor).

    Text files: file content is read and embedded directly.
    Other binaries: embedded as raw bytes.
    """
    mime_type = magic.from_file(file_path, mime=True)
    is_text_mime = mime_type.startswith("text/") or mime_type in _TEXT_MIMES

    try:
        if mime_type.startswith("image/"):
            if description:
                content_parts = [description]
                print(f"Embedding {os.path.basename(file_path)} via AI caption")
            else:
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                content_parts = [types.Part.from_bytes(data=file_bytes, mime_type=mime_type)]
                print(f"Embedding {os.path.basename(file_path)} as raw image bytes (no caption)")

        elif mime_type == "application/pdf":
            if description:
                content_parts = [description]
                print(f"Embedding {os.path.basename(file_path)} via extracted PDF text ({len(description)} chars)")
            else:
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                content_parts = [types.Part.from_bytes(data=file_bytes, mime_type=mime_type)]
                print(f"Embedding {os.path.basename(file_path)} as raw PDF bytes (no text extracted)")

        elif is_text_mime:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    text = f.read()[:10000]
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="latin-1") as f:
                    text = f.read()[:10000]
            content_parts = [text]
            print(f"Embedding {os.path.basename(file_path)} as text ({mime_type})")

        else:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            content_parts = [types.Part.from_bytes(data=file_bytes, mime_type=mime_type)]
            if description:
                content_parts.insert(0, description)
            print(f"Embedding {os.path.basename(file_path)} as binary ({mime_type})")

    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None

    try:
        res = client.models.embed_content(
            model="gemini-embedding-2-preview",
            contents=content_parts,
            config={
                'task_type': task_type,
                'output_dimensionality': 768
            }
        )
        return res.embeddings[0].values
    except exceptions.InvalidArgument as e:
        print(f"Validation Error ({mime_type}): {e}")
        return None
    except Exception as e:
        print(f"Embedding error: {e}")
        return None


def get_query_embedding(query_text):
    try:
        res = client.models.embed_content(
            model="gemini-embedding-2-preview",
            contents=query_text,
            config={
                'task_type': 'RETRIEVAL_QUERY',
                'output_dimensionality': 768
            }
        )
        return res.embeddings[0].values
    except Exception as e:
        print(f"Error embedding query: {e}")
        return None
