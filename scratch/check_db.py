import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["nebula"]
collection = db["files"]

for doc in collection.find({"filename": {"$regex": "puppy", "$options": "i"}}):
    print(f"Found: {doc['filename']} at {doc['filepath']}")
