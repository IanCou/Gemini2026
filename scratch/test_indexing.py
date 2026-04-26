import os
import sys
from pathlib import Path

# Add front_end and backend to path
repo_root = Path("/Users/iancoutinho/Documents/Coding/Gemini2026")
sys.path.append(str(repo_root / "front_end"))
sys.path.append(str(repo_root / "backend"))

from env_bootstrap import load_project_env
load_project_env()

from add_element import ingest_file_to_db

file_path = str(repo_root / "img" / "golden_retriever_puppy.jpeg")
print(f"Indexing {file_path}...")
res = ingest_file_to_db(file_path)
print(f"Result: {res}")
