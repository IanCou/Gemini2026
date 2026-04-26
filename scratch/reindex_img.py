import os
import sys
from pathlib import Path

# Add front_end and backend to path
repo_root = Path("/Users/iancoutinho/Documents/Coding/Gemini2026")
sys.path.append(str(repo_root / "front_end"))
sys.path.append(str(repo_root / "backend"))

from env_bootstrap import load_project_env
load_project_env()

from pymongo import MongoClient
from add_element import ingest_file_to_db

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["nebula"]
collection = db["files"]

img_dir = repo_root / "img"
print(f"Cleaning up and re-indexing {img_dir}...")

# Delete existing entries for this directory
img_abs = str(img_dir.resolve())
res = collection.delete_many({"filepath": {"$regex": f"^{img_abs}"}})
print(f"Removed {res.deleted_count} old entries.")

# Re-index
for f in img_dir.iterdir():
    if f.is_file() and f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        print(f"Indexing {f.name}...")
        ingest_file_to_db(str(f.resolve()))

print("Done!")
