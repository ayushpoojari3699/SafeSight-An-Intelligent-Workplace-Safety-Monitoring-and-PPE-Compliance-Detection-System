from pymongo import MongoClient

# ----------------------------------------
# Connect to MongoDB
# ----------------------------------------
client = MongoClient("mongodb://localhost:27017")

# ----------------------------------------
# Database
# ----------------------------------------
db = client["SAFESIGHT"]

# ----------------------------------------
# Collections
# ----------------------------------------
detections = db["detection_history"]

# New collection for uploaded manuals/documents
documents = db["documents"]

print("MongoDB Connected Successfully")