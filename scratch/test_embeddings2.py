import os
import sys
from pathlib import Path

repo_root = Path("/Users/iancoutinho/Documents/Coding/Gemini2026")
sys.path.append(str(repo_root / "front_end"))
sys.path.append(str(repo_root / "backend"))

from env_bootstrap import load_project_env
load_project_env()

import numpy as np
from input_to_embedding import get_query_embedding, get_multimodal_embedding

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0: return 0.0
    return float(np.dot(a, b) / denom)

q_emb = get_query_embedding("puppy")
q_emb = np.array(q_emb, dtype="float32")

# Embed mixed using get_multimodal_embedding
mixed_emb = get_multimodal_embedding(str(repo_root / "img/golden_retriever_puppy.jpeg"), description="golden retriever puppy")
mixed_emb = np.array(mixed_emb, dtype="float32")
print(f"Score mixed (using get_multimodal_embedding): {_cosine_similarity(q_emb, mixed_emb):.4f}")

# Embed req using get_multimodal_embedding
req_emb = get_multimodal_embedding(str(repo_root / "front_end/requirements.txt"))
req_emb = np.array(req_emb, dtype="float32")
print(f"Score requirements.txt (using get_multimodal_embedding): {_cosine_similarity(q_emb, req_emb):.4f}")
