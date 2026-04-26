import os
import magic
import hashlib
from google import genai
from google.genai import types
from pymongo import MongoClient, UpdateOne
from input_to_embedding import get_multimodal_embedding

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "yhacks"
COLLECTION_NAME = "files"

client = genai.Client(api_key=GEMINI_API_KEY)
db_client = MongoClient(MONGO_URI)
collection = db_client[DB_NAME][COLLECTION_NAME]

def process_and_embed_file(file_path, description=None):
    """
    Generates an embedding for a file and returns the document dictionary.
    Skips the file if its hash hasn't changed in the DB.
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

    existing = collection.find_one({"filepath": abs_path})
    if existing and existing.get("file_hash") == file_hash:
        # print(f"Skipping {file_name}: Unchanged (Warm Start)")
        return {"_id": existing["_id"], "skipped": True}

    mime_type = magic.from_file(file_path, mime=True)

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
            "description_provided": bool(description)
        }
    }
    return document

def bulk_upsert_documents(documents):
    if not documents:
        return
    
    # Filter out skipped documents before upserting
    docs_to_upsert = [d for d in documents if not d.get("skipped")]
    if not docs_to_upsert:
        return

    operations = [
        UpdateOne(
            {"filepath": doc["filepath"]}, 
            {"$set": doc}, 
            upsert=True
        ) for doc in docs_to_upsert
    ]
    
    collection.bulk_write(operations)

def ingest_file_to_db(file_path, description=None):
    doc = process_and_embed_file(file_path, description)
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