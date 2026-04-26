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

# Embed purely text
text_emb = get_multimodal_embedding(str(repo_root / "backend/input_to_embedding.py"), description="golden retriever puppy") # This will actually combine text and file. Wait, I'll just use client.models.embed_content.

from google import genai
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

res = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents="golden retriever puppy",
    config={'task_type': 'RETRIEVAL_DOCUMENT', 'output_dimensionality': 768}
)
pure_text_emb = np.array(res.embeddings[0].values, dtype="float32")
print(f"Score pure text 'golden retriever puppy': {_cosine_similarity(q_emb, pure_text_emb):.4f}")

# Embed purely image
with open(str(repo_root / "img/golden_retriever_puppy.jpeg"), "rb") as f:
    img_bytes = f.read()
from google.genai import types
img_part = types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")

res = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents=[img_part],
    config={'task_type': 'RETRIEVAL_DOCUMENT', 'output_dimensionality': 768}
)
pure_img_emb = np.array(res.embeddings[0].values, dtype="float32")
print(f"Score pure image: {_cosine_similarity(q_emb, pure_img_emb):.4f}")

# Embed image + text
res = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents=["golden retriever puppy", img_part],
    config={'task_type': 'RETRIEVAL_DOCUMENT', 'output_dimensionality': 768}
)
mixed_emb = np.array(res.embeddings[0].values, dtype="float32")
print(f"Score mixed (text+img): {_cosine_similarity(q_emb, mixed_emb):.4f}")

# Test against requirements.txt content
req_text = (repo_root / "front_end/requirements.txt").read_text()
res = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents=req_text,
    config={'task_type': 'RETRIEVAL_DOCUMENT', 'output_dimensionality': 768}
)
req_emb = np.array(res.embeddings[0].values, dtype="float32")
print(f"Score requirements.txt: {_cosine_similarity(q_emb, req_emb):.4f}")

