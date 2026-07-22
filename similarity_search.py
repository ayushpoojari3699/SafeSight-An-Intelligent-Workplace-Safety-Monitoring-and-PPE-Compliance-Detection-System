import faiss
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer

# -------------------------------
# Load Embedding Model
# -------------------------------
model = SentenceTransformer("all-MiniLM-L6-v2")

# -------------------------------
# Load FAISS Index
# -------------------------------
# Fixed: Changed from "safesight.index" to "faiss_index.index"
# This matches what faiss_db.py creates
index = faiss.read_index("faiss_index.index")

# -------------------------------
# DEBUG: Check Index Dimension
# -------------------------------
print("=" * 60)
print("DEBUG: Similarity Search Initialization")
print("=" * 60)
print(f"Index dimension: {index.d}")
print(f"Index contains: {index.ntotal} documents")
print("=" * 60)

# -------------------------------
# Load Documents
# -------------------------------
with open("documents.pkl", "rb") as f:
    documents = pickle.load(f)

# Print all document filenames for debugging
print("\nDocuments in index:")
for i, doc in enumerate(documents):
    filename = doc.get('filename') or doc.get('image') or 'Unknown'
    doc_type = doc.get('type', 'unknown')
    print(f"  {i}: {doc_type:12} | {filename}")
print("=" * 60)


def search(query, top_k=3):

    # Convert query to embedding
    query_embedding = model.encode(
        [query],
        convert_to_numpy=True,
        normalize_embeddings=True
    ).astype("float32")

    # -------------------------------
    # DEBUG: Check Query Dimension
    # -------------------------------
    print(f"\n Query: {query[:50]}...")
    print(f"Query dimension: {query_embedding.shape[1]}")
    print(f"Index dimension: {index.d}")
    
    if query_embedding.shape[1] != index.d:
        print(f" DIMENSION MISMATCH! Query: {query_embedding.shape[1]}, Index: {index.d}")
        print("   This will cause FAISS search to fail!")
        return []

    # Prevent requesting more results than exist
    top_k = min(top_k, index.ntotal)

    # Similarity Search
    scores, indices = index.search(query_embedding, top_k)

    # ============================================================
    # DEBUG: Print what FAISS is returning
    # ============================================================
    print("-" * 60)
    print("FAISS RAW RESULTS:")
    print(f"   Scores shape: {scores.shape}")
    print(f"   Indices shape: {indices.shape}")
    print(f"   Scores: {scores}")
    print(f"   Indices: {indices}")
    
    # Check for invalid results
    if len(scores[0]) == 0:
        print("    No scores returned!")
    else:
        print(f"   Best score: {scores[0][0]:.4f}")
        print(f"   Worst score: {scores[0][-1]:.4f}")
        print(f"   Average score: {np.mean(scores[0]):.4f}")
    
    # Check for invalid indices
    invalid_indices = [idx for idx in indices[0] if idx == -1]
    if invalid_indices:
        print(f"    Invalid indices (-1): {invalid_indices}")
    
    valid_indices = [idx for idx in indices[0] if idx != -1]
    print(f"   Valid indices: {valid_indices}")
    
    # Print the actual documents being returned
    print("\n📄 Retrieved Documents:")
    for idx in valid_indices:
        if idx < len(documents):
            doc = documents[idx]
            filename = doc.get('filename') or doc.get('image') or 'Unknown'
            doc_type = doc.get('type', 'unknown')
            print(f"   Index {idx}: {doc_type:12} | {filename}")
        else:
            print(f"   Index {idx}: INVALID (out of range)")
    print("-" * 60)

    results = []

    for score, idx in zip(scores[0], indices[0]):

        if idx == -1:
            print(f"   Skipping invalid index -1 with score {score:.4f}")
            continue

        results.append({
            "score": float(score),
            "document": documents[idx]
        })

    print(f" Returning {len(results)} valid results\n")

    return results


# -------------------------------
# Testing
# -------------------------------
if __name__ == "__main__":

    print("=" * 60)
    print("Testing Similarity Search")
    print("=" * 60)
    print(f"Index contains {index.ntotal} documents\n")

    # Test queries
    test_queries = [
        "What PPE is required for construction workers?",
        "Are workers wearing helmets?",
        "Safety violations on site",
        "What are the safety guidelines?"
    ]

    for query in test_queries:
        print(f"\n Query: {query}")
        print("-" * 60)

        results = search(query, top_k=5)

        if not results:
            print("No results found.")
            continue

        for i, result in enumerate(results, 1):
            doc = result["document"]
            score = result["score"]

            # Determine document type for display
            doc_type = doc.get('document_type', 'Unknown')
            filename = doc.get('filename', 'Unknown')
            
            # Format based on document type
            if doc_type in ["PDF Manual", "DOCX Manual", "Text Document"]:
                print(f"\nResult {i} (Score: {score:.4f}):")
                print(f"  Document: {filename}")
                print(f"  Type: {doc_type}")
            else:
                print(f"\n  Result {i} (Score: {score:.4f}):")
                print(f"  Image: {filename}")
                print(f"  Status: {doc.get('status', 'Unknown')}")
                site = doc.get('site_name', 'Unknown')
                if site != 'Unknown':
                    print(f"  Site: {site}")

            # Preview the text (first 200 characters)
            text_preview = doc.get('text', '')[:200].replace('\n', ' ')
            print(f"  Preview: {text_preview}...")

    print("\n" + "=" * 60)