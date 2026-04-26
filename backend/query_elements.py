import os
import pprint
from google import genai
from pymongo import MongoClient
from pymongo.errors import OperationFailure

from input_to_embedding import get_query_embedding

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "yhacks"
COLLECTION_NAME = "files"
VECTOR_INDEX_NAME = "vector_index"
EXPECTED_EMBEDDING_DIMS = 768

client = genai.Client(api_key=GEMINI_API_KEY)
db_client = MongoClient(MONGO_URI)
collection = db_client[DB_NAME][COLLECTION_NAME]

def similarity_search_with_score(
    query: str, k: int = 3, project_id: str | None = None
) -> list[tuple[dict, float]]:
    """
    LangChain-style API: returns [(document_fields, score), ...].
    document_fields matches $project (no embedding); score is vectorSearchScore.
    """
    try:
        query_embedding = get_query_embedding(query)
    except Exception as e:
        print(f"Failed to embed query: {e}")
        return []

    if not query_embedding:
        print("No query vector returned (check GEMINI_API_KEY / embedding errors).")
        return []

    fetch_k = (k * 10) if project_id else k
    vs = {
        "index": VECTOR_INDEX_NAME,
        "path": "embedding",
        "queryVector": query_embedding,
        "numCandidates": max(50, fetch_k * 10),
        "limit": fetch_k,
    }
        
    pipeline = [
        {
            "$vectorSearch": vs
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
        cursor = collection.aggregate(pipeline)
        for doc in cursor:
            score = float(doc.pop("score", 0.0))
            out.append((doc, score))
    except OperationFailure as e:
        details = getattr(e, "details", None) or str(e)
        print(f"MongoDB $vectorSearch failed: {details}")
        return []

    if project_id:
        ids = [d.get("_id") for d, _ in out if d.get("_id")]
        if ids:
            keep = {d["_id"] for d in collection.find({"_id": {"$in": ids}, "project_id": project_id}, {"_id": 1})}
            out = [(d, s) for d, s in out if d.get("_id") in keep]

    return out[:k]


if __name__ == "__main__":
    query = "fourier transform"
    results = similarity_search_with_score(query=query, k=3)
    pprint.pprint(results)