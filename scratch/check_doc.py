import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["nebula"]
collection = db["files"]

doc = collection.find_one({"filename": "golden_retriever_puppy.jpeg"})
if doc:
    print(f"Found {doc['filename']}")
    print(f"Embedding exists: {'embedding' in doc}")
    if 'embedding' in doc:
        print(f"Embedding length: {len(doc['embedding'])}")
else:
    print("Not found")
