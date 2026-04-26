import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["nebula"]
collection = db["files"]

pid = "c0162fe26077"
print(f"Checking for project {pid}")
count = collection.count_documents({"project_id": pid})
print(f"Total files in project: {count}")

for doc in collection.find({"project_id": pid}, {"filename": 1}):
    print(f"- {doc['filename']}")
