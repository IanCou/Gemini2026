import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["nebula"]
collection = db["files"]

# Find all unique project_ids
pids = collection.distinct("project_id")
print("Unique project IDs in DB:", pids)

for pid in pids:
    if pid:
        count = collection.count_documents({"project_id": pid})
        sample = collection.find_one({"project_id": pid})
        print(f"Project: {pid} | Count: {count} | Sample: {sample['filepath'] if sample else 'N/A'}")
