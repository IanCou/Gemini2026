import os
import sys
from pathlib import Path

# Add front_end and backend to path
repo_root = Path("/Users/iancoutinho/Documents/Coding/Gemini2026")
sys.path.append(str(repo_root / "front_end"))
sys.path.append(str(repo_root / "backend"))

from env_bootstrap import load_project_env
load_project_env()

from query_elements import similarity_search_with_score

query = "image of the puppy"
print(f"Searching for: {query}")
results = similarity_search_with_score(query)
for doc, score in results:
    print(f"Score: {score:.4f} | File: {doc['filename']}")
