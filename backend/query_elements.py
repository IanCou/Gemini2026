import os
import pprint
import numpy as np
from google import genai
from pymongo import MongoClient
from pymongo.errors import OperationFailure

from input_to_embedding import get_query_embedding

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "nebula"
COLLECTION_NAME = "files"
VECTOR_INDEX_NAME = "vector_index"
EXPECTED_EMBEDDING_DIMS = 768

client = genai.Client(api_key=GEMINI_API_KEY)
db_client = MongoClient(MONGO_URI)
collection = db_client[DB_NAME][COLLECTION_NAME]


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def similarity_search_with_score(
    query: str, k: int = 15, project_id: str | None = None
) -> list[tuple[dict, float]]:
    """
    Returns [(document_fields, score), ...] sorted by score descending.

    When project_id is given, loads all project embeddings from MongoDB and
    computes exact cosine similarity in Python — this avoids the Atlas post-filter
    problem where project files get buried under global noise in the ANN results.

    When project_id is None, uses the Atlas $vectorSearch index for speed.
    """
    try:
        query_embedding = get_query_embedding(query)
    except Exception as e:
        print(f"Failed to embed query: {e}")
        return []

    if not query_embedding:
        print("No query vector returned (check GEMINI_API_KEY / embedding errors).")
        return []

    q = np.array(query_embedding, dtype="float32")

    # ── Project-scoped: exact in-memory cosine search ────────────────────────
    if project_id:
        docs = list(collection.find(
            {"project_id": project_id, "embedding": {"$exists": True}},
            {"_id": 1, "filename": 1, "file_type": 1, "filepath": 1,
             "page_range": 1, "embedding": 1},
        ))
        if not docs:
            return []
        scored: list[tuple[dict, float]] = []
        for doc in docs:
            emb = np.array(doc.pop("embedding"), dtype="float32")
            score = _cosine_similarity(q, emb)
            scored.append((doc, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]

    # ── Unscoped: use Atlas vector index ─────────────────────────────────────
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": max(50, k * 10),
                "limit": k,
            }
        },
        {
            "$project": {
                "_id": 1,
                "filename": 1,
                "file_type": 1,
                "filepath": 1,
                "page_range": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    out: list[tuple[dict, float]] = []
    try:
        for doc in collection.aggregate(pipeline):
            score = float(doc.pop("score", 0.0))
            out.append((doc, score))
    except OperationFailure as e:
        details = getattr(e, "details", None) or str(e)
        print(f"MongoDB $vectorSearch failed: {details}")
        return []

    return out


if __name__ == "__main__":
    query = "fourier transform"
    results = similarity_search_with_score(query=query, k=3)
    pprint.pprint(results)
