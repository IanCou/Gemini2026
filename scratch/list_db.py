import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["nebula"]
collection = db["files"]

print("Total files in DB:", collection.count_documents({}))
for doc in collection.find({}, {"filename": 1}):
    print(f"- {doc['filename']}")
