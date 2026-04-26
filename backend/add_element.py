import os
import magic
import hashlib
from google import genai
from google.genai import types
from pymongo import MongoClient, UpdateOne
from input_to_embedding import get_multimodal_embedding

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "nebula"
COLLECTION_NAME = "files"

client = genai.Client(api_key=GEMINI_API_KEY)
db_client = MongoClient(MONGO_URI)
collection = db_client[DB_NAME][COLLECTION_NAME]


def _caption_image(file_path: str, mime_type: str) -> str | None:
    """Generate a semantic caption for an image using Gemini Flash."""
    try:
        with open(file_path, "rb") as f:
            image_bytes = f.read()
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                "Describe this image in 1-2 sentences. Be specific about the subjects, actions, and context visible.",
            ],
        )
        caption = resp.text.strip()
        print(f"Caption for {os.path.basename(file_path)}: {caption[:80]}...")
        return caption
    except Exception as e:
        print(f"Caption generation failed for {file_path}: {e}")
        return None


def _extract_pdf_text(file_path: str, max_chars: int = 8000) -> str | None:
    """Extract text from a PDF using PyMuPDF."""
    try:
        import fitz  # pymupdf
        doc = fitz.open(file_path)
        pages_text = [page.get_text() for page in doc]
        doc.close()
        text = "\n".join(pages_text).strip()
        if not text:
            return None
        print(f"Extracted {len(text)} chars from {os.path.basename(file_path)}")
        return text[:max_chars]
    except ImportError:
        print("pymupdf not installed; PDF text extraction skipped")
        return None
    except Exception as e:
        print(f"PDF extraction failed for {file_path}: {e}")
        return None


def process_and_embed_file(file_path, description=None, force=False):
    """
    Generate an embedding for a file and return the document dict.
    Skips unchanged files unless force=True.
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return None

    file_name = os.path.basename(file_path)
    abs_path = os.path.abspath(file_path)

    try:
        with open(file_path, 'rb') as f:
            raw_bytes = f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None

    file_hash = hashlib.md5(raw_bytes).hexdigest()

    if not force:
        existing = collection.find_one({"filepath": abs_path})
        if existing and existing.get("file_hash") == file_hash:
            return {"_id": existing["_id"], "skipped": True}

    mime_type = magic.from_file(file_path, mime=True)

    # Generate semantic content for types that benefit from it
    if not description:
        if mime_type.startswith("image/"):
            caption = _caption_image(file_path, mime_type)
            if caption:
                description = caption
            else:
                # Fallback: filename as text
                name_no_ext = os.path.splitext(file_name)[0]
                description = name_no_ext.replace("_", " ").replace("-", " ")
        elif mime_type == "application/pdf":
            description = _extract_pdf_text(file_path)

    embedding = get_multimodal_embedding(file_path, description)
    if embedding is None:
        print("Error: No embedding produced; not inserting.")
        return None

    document = {
        "filename": file_name,
        "filepath": abs_path,
        "file_type": mime_type,
        "file_hash": file_hash,
        "embedding": embedding,
        "metadata": {
            "file_size": len(raw_bytes),
            "description_provided": bool(description),
        }
    }
    return document


def bulk_upsert_documents(documents):
    docs_to_upsert = [d for d in documents if not d.get("skipped")]
    if not docs_to_upsert:
        return
    operations = [
        UpdateOne({"filepath": doc["filepath"]}, {"$set": doc}, upsert=True)
        for doc in docs_to_upsert
    ]
    collection.bulk_write(operations)


def ingest_file_to_db(file_path, description=None, force=False):
    doc = process_and_embed_file(file_path, description, force=force)
    if not doc:
        return None
    if doc.get("skipped"):
        return str(doc["_id"])
    try:
        res = collection.insert_one(doc)
        return str(res.inserted_id)
    except Exception as e:
        print(f"Failed to insert: {e}")
        return None


if __name__ == "__main__":
    pass
