import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["nebula"]
collection = db["files"]

pid = "c0162fe26077"
print(f"Searching for puppy image in project {pid}...")
doc = collection.find_one({"filename": "golden_retriever_puppy.jpeg", "project_id": pid})
if doc:
    print(f"Found it! Score: {doc.get('score', 'N/A')}")
else:
    print("Not found in project.")
    
print("Searching globally...")
doc_global = collection.find_one({"filename": "golden_retriever_puppy.jpeg"})
if doc_global:
    print(f"Found globally! project_id: {doc_global.get('project_id')}")
else:
    print("Not found anywhere.")
