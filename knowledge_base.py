from embedding import generate_embeddings
from faiss_db import build_faiss_index
import traceback


def update_knowledge_base():

    try:
        print("=" * 60)
        print("Updating Knowledge Base...")
        print("=" * 60)

        # Step 1: Generate embeddings from all documents
        print("\n[1/2] Generating embeddings...")
        generate_embeddings()
        print("✓ Embeddings generated successfully.\n")

        # Step 2: Build FAISS index
        print("[2/2] Building FAISS index...")
        build_faiss_index()
        print("✓ FAISS index built successfully.\n")

        print("=" * 60)
        print("✅ Knowledge Base Updated Successfully.")
        print("=" * 60)

    except FileNotFoundError as e:
        print("=" * 60)
        print("❌ Knowledge Base Update Failed")
        print(f"File not found: {e}")
        print("=" * 60)
        print("\n💡 Hint: Make sure documents exist in MongoDB or the data directory.")
        raise

    except Exception as e:
        print("=" * 60)
        print("❌ Knowledge Base Update Failed")
        print(f"Error: {e}")
        print("=" * 60)
        print("\n💡 Debug Information:")
        traceback.print_exc()
        raise


if __name__ == "__main__":

    update_knowledge_base()