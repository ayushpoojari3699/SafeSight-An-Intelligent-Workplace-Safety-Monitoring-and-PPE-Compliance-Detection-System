from database import detections, documents
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List
import os
import shutil
import traceback
from datetime import datetime
from detect import detect_objects
from associate import associate_ppe
from violation_checker import check_violations
from pydantic import BaseModel
from rag_pipeline import ask_question
from document_processor import extract_text
from knowledge_base import update_knowledge_base

app = FastAPI(
    title="Safesight API",
    description="AI-Based Construction PPE Detection API",
    version="2.0.0"
)

# ----------------------------------------------------
# CORS
# ----------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# Create Required Folders
# ----------------------------------------------------
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
DOCUMENT_FOLDER = "documents"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(DOCUMENT_FOLDER, exist_ok=True)

# ----------------------------------------------------
# Serve Annotated Images and Documents
# ----------------------------------------------------
app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUT_FOLDER),
    name="outputs"
)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_FOLDER),
    name="uploads"
)

app.mount(
    "/documents",
    StaticFiles(directory=DOCUMENT_FOLDER),
    name="documents"
)

# ----------------------------------------------------
# Chat Request Model
# ----------------------------------------------------
class ChatRequest(BaseModel):
    question: str


# ----------------------------------------------------
# Health Check
# ----------------------------------------------------
@app.get("/")
def home():
    return {
        "status": "running",
        "project": "Safesight",
        "version": "2.0.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# ----------------------------------------------------
# Multiple Image Detection Endpoint
# ----------------------------------------------------
@app.post("/detect")
async def detect(files: List[UploadFile] = File(...)):
    images = []
    summary = {
        "total_images": 0,
        "total_workers": 0,
        "safe_workers": 0,
        "unsafe_workers": 0,
        "helmet": 0,
        "vest": 0,
        "gloves": 0,
        "boots": 0,
        "goggles": 0,
        "compliance": 0
    }
    logs = []

    for file in files:
        # -----------------------------
        # Save Uploaded Image
        # -----------------------------
        upload_path = os.path.join(
            UPLOAD_FOLDER,
            file.filename
        )
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # -----------------------------
        # Run YOLO Detection
        # -----------------------------
        results = detect_objects(upload_path)

        # -----------------------------
        # Save Annotated Image
        # -----------------------------
        output_path = os.path.join(
            OUTPUT_FOLDER,
            file.filename
        )
        results[0].save(filename=output_path)

        # -----------------------------
        # Associate PPE with Workers
        # -----------------------------
        workers = associate_ppe(results)

        # -----------------------------
        # Check Violations / Build Worker Status
        # -----------------------------
        report = check_violations(workers)

        processed_workers = report["workers"]

        summary["total_workers"] += len(processed_workers)
        summary["safe_workers"] += report["summary"]["safe_workers"]
        summary["unsafe_workers"] += report["summary"]["unsafe_workers"]

        summary["helmet"] += report["summary"]["helmet"]
        summary["vest"] += report["summary"]["vest"]
        summary["gloves"] += report["summary"]["gloves"]
        summary["boots"] += report["summary"]["boots"]
        summary["goggles"] += report["summary"]["goggles"]

        summary["total_images"] += 1

        images.append(
            {
                "name": file.filename,
                "site_name": "Construction Site A",
                "original": f"http://127.0.0.1:8000/uploads/{file.filename}",
                "annotated": f"http://127.0.0.1:8000/outputs/{file.filename}",
                "workers": processed_workers,
            }
        )

        # -----------------------------
        # Kept for lightweight logging only
        # (NOT used for the stored record anymore)
        # -----------------------------
        logs.append(
            {
                "timestamp": str(datetime.now()),
                "image": file.filename,
                "workers": len(processed_workers),
                "unsafe": len(
                    [
                        w
                        for w in processed_workers
                        if w["status"] == "Unsafe"
                    ]
                ),
            }
        )

    # ----------------------------------------------------
    # Calculate Overall Compliance
    # ----------------------------------------------------
    total_required_ppe = summary["total_workers"] * 5
    total_missing_ppe = (
        summary["helmet"]
        + summary["vest"]
        + summary["gloves"]
        + summary["boots"]
        + summary["goggles"]
    )

    if total_required_ppe > 0:
        summary["compliance"] = round(
            ((total_required_ppe - total_missing_ppe)
             / total_required_ppe) * 100,
            2
        )
    else:
        summary["compliance"] = 100.0

    # ----------------------------------------------------
    # Save Detection History to MongoDB
    # ----------------------------------------------------
    # IMPORTANT: store `images` (full worker objects), not `logs`
    # (which only holds a worker COUNT, not the worker list itself)
    # ----------------------------------------------------
    record = {
        "timestamp": str(datetime.now()),
        "summary": summary,
        "images": images
    }

    try:
        detections.insert_one(record)
        print("Detection history saved to MongoDB.")
    except Exception as e:
        print(f"MongoDB Error: {e}")

    # ----------------------------------------------------
    # Return Response
    # ----------------------------------------------------
    return {
        "summary": summary,
        "images": images
    }


# ----------------------------------------------------
# Upload Safety Manual / Inspection Report
# ----------------------------------------------------
@app.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):

    try:
        print("=" * 60)
        print("📤 DOCUMENT UPLOAD REQUEST RECEIVED")
        print(f"   Filename: {file.filename}")
        print(f"   Content-Type: {file.content_type}")
        print("=" * 60)

        print("1️⃣ Checking file extension...")
        # Check if file extension is supported
        allowed_extensions = [".pdf", ".docx", ".txt"]
        extension = os.path.splitext(file.filename)[1].lower()

        if extension not in allowed_extensions:
            print(f"❌ Unsupported extension: {extension}")
            return {
                "success": False,
                "error": "Only PDF, DOCX and TXT files are supported."
            }
        print(f"   ✅ Extension '{extension}' is supported.")

        # Determine document type based on extension
        if extension == ".pdf":
            doc_type = "PDF Manual"
        elif extension == ".docx":
            doc_type = "DOCX Manual"
        elif extension == ".txt":
            doc_type = "Text Document"
        else:
            doc_type = "Unknown"
        print(f"   📄 Document type: {doc_type}")

        # Save uploaded file
        print("2️⃣ Saving file...")
        save_path = os.path.join(DOCUMENT_FOLDER, file.filename)
        print(f"   📁 Path: {save_path}")

        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print("   ✅ File saved successfully.")

        # Extract text
        print("3️⃣ Extracting text...")
        extracted_text = extract_text(save_path)
        print(f"   📝 Text extracted: {len(extracted_text)} characters")
        print(f"   📊 Preview: {extracted_text[:100]}...")

        # Store in MongoDB with document type
        print("4️⃣ Storing in MongoDB...")
        document = {
            "filename": file.filename,
            "filepath": save_path,
            "document_type": doc_type,
            "uploaded_at": str(datetime.now()),
            "text": extracted_text
        }

        # Replace existing document if filename already exists, otherwise insert
        result = documents.replace_one(
            {"filename": file.filename},
            document,
            upsert=True
        )
        print(f"   ✅ MongoDB updated. Matched: {result.matched_count}, Modified: {result.modified_count}, Upserted: {result.upserted_id is not None}")

        # ----------------------------------------------------
        # ⚠️ SYNC KNOWLEDGE BASE UPDATE (College Project)
        # ----------------------------------------------------
        print("5️⃣ Updating knowledge base...")
        kb_updated = True
        try:
            update_knowledge_base()
            print(f"   ✅ Knowledge base updated with {file.filename}")
        except Exception as e:
            kb_updated = False
            print(f"   ❌ Knowledge base update error: {e}")

        # ----------------------------------------------------
        # Return Response with Knowledge Base Status
        # ----------------------------------------------------
        print("=" * 60)
        print("✅ UPLOAD COMPLETE")
        print(f"   Knowledge Base Updated: {kb_updated}")
        print("=" * 60)

        return {
            "success": True,
            "message": "Document uploaded successfully.",
            "knowledge_base_updated": kb_updated,
            "filename": file.filename,
            "document_type": doc_type,
            "characters": len(extracted_text),
            "url": f"http://127.0.0.1:8000/documents/{file.filename}"
        }

    except Exception as e:
        print("=" * 60)
        print("❌ UPLOAD FAILED")
        print(f"   Error: {str(e)}")
        print("=" * 60)
        traceback.print_exc()
        
        return {
            "success": False,
            "error": str(e)
        }


# ----------------------------------------------------
# AI Assistant (RAG Chat)
# ----------------------------------------------------
@app.post("/chat")
def chat(request: ChatRequest):

    try:
        print("=" * 60)
        print("💬 CHAT REQUEST RECEIVED")
        print(f"   Question: {request.question}")
        print("=" * 60)

        # Validate that question is not empty
        if not request.question or not request.question.strip():
            return {
                "success": False,
                "error": "Question cannot be empty. Please provide a valid question."
            }

        result = ask_question(request.question)

        print("✅ Chat response generated successfully")
        print(f"   Answer length: {len(result['answer'])} characters")
        print(f"   Sources: {len(result['sources'])}")

        return {
            "success": True,
            "question": request.question,
            "answer": result["answer"],
            "sources": result["sources"]
        }

    except Exception as e:
        print("=" * 60)
        print("❌ CHAT FAILED")
        print(f"   Error: {str(e)}")
        print("=" * 60)
        traceback.print_exc()

        return {
            "success": False,
            "error": str(e)
        }


# ----------------------------------------------------
# Optional: Manual Knowledge Base Update Endpoint
# ----------------------------------------------------
@app.post("/rebuild-knowledge-base")
async def rebuild_knowledge_base():
    """
    Manually trigger a rebuild of the knowledge base.
    Useful if documents were added directly to MongoDB or filesystem.
    """
    try:
        update_knowledge_base()
        return {
            "success": True,
            "message": "Knowledge base rebuilt successfully."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to rebuild knowledge base: {str(e)}"
        )