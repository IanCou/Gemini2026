import os
import sys
from pathlib import Path

repo_root = Path("/Users/iancoutinho/Documents/Coding/Gemini2026")
sys.path.append(str(repo_root / "front_end"))
from env_bootstrap import load_project_env
load_project_env()

from pymongo import MongoClient

client = MongoClient(os.getenv('MONGO_URI'))
coll = client['nebula']['files']
count = coll.count_documents({})
print(f"Total documents: {count}")

docs = list(coll.find({}, {"filepath": 1, "filename": 1}))
print("\nFirst 10 documents:")
for doc in docs[:10]:
    print(doc.get('filepath'))

puppy = [d for d in docs if "puppy" in str(d.get("filename")).lower()]
print(f"\nPuppy documents: {len(puppy)}")
for p in puppy:
    print(p)
