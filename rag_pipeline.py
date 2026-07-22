from similarity_search import search
from langchain_ollama import ChatOllama

# --------------------------------------------------
# Load Llama 3.1
# --------------------------------------------------
llm = ChatOllama(
    model="llama3.1",
    temperature=0
)

# --------------------------------------------------
# RAG Pipeline
# --------------------------------------------------
def ask_question(question):

    # ============================================================
    # TEMPORARY DEBUG: Print the exact question received
    # ============================================================
    print("=" * 60)
    print(f"🔍 RAG PIPELINE RECEIVED QUESTION:")
    print(f"   Raw: {repr(question)}")
    print(f"   Type: {type(question)}")
    print(f"   Length: {len(question) if question else 0}")
    print("=" * 60)

    # Retrieve top similar documents
    results = search(question, top_k=20)

    # ============================================================
    # DEBUG: Print raw retrieval results
    # ============================================================
    print("=" * 60)
    print(f"📊 RETRIEVED: {len(results)} documents")
    print("-" * 60)
    for i, r in enumerate(results, 1):
        doc = r["document"]
        doc_type = doc.get("type", "unknown")
        score = r["score"]
        filename = doc.get("filename") or doc.get("image") or "Unknown"
        print(f"{i:2}. Type: {doc_type:12} | Score: {score:.4f} | File: {filename}")
    print("=" * 60)

    if not results:
        return {
            "answer": "No relevant reports were found.",
            "sources": []
        }

    # --------------------------------------------------
    # Sort All Results by Score (Highest First)
    # --------------------------------------------------
    results = sorted(results, key=lambda x: x["score"], reverse=True)

    # --------------------------------------------------
    # Remove Duplicate Chunks (Using Full Text)
    # --------------------------------------------------
    seen = set()
    filtered = []

    for r in results:
        doc = r["document"]
        
        # Use filename/image + full text for deduplication
        key = (
            doc.get("filename") or doc.get("image", "unknown"),
            doc["text"]
        )

        if key not in seen:
            seen.add(key)
            filtered.append(r)

    results = filtered

    # --------------------------------------------------
    # DEBUG: Don't filter by score - keep top 8 results
    # --------------------------------------------------
    # MIN_SCORE = 0.55  # Temporarily disabled for debugging
    # results = [
    #     r for r in results
    #     if r["score"] >= MIN_SCORE
    # ][:8]
    
    # Keep top 8 results regardless of score
    results = results[:8]

    # --------------------------------------------------
    # Debug Output (Keep Scores Visible)
    # --------------------------------------------------
    print("\n" + "=" * 60)
    print("🔍 Filtered Results (Top 8, No Score Filter):")
    print("=" * 60)
    for i, r in enumerate(results, 1):
        doc = r["document"]
        doc_type = doc.get("type", "unknown")
        score = r["score"]
        name = doc.get('image') or doc.get('filename', 'Unknown')
        site = doc.get('site_name', 'N/A')
        print(f"{i:2}. {doc_type:12} | Score: {score:.4f} | {name} | Site: {site}")
    print("=" * 60 + "\n")

    # --------------------------------------------------
    # Build Rich Context with Metadata (Only if Present)
    # --------------------------------------------------
    context_parts = []

    for i, r in enumerate(results, 1):
        doc = r["document"]
        
        # Determine source name
        source = doc.get('filename') or doc.get('image') or 'Unknown'
        
        # Build metadata list (only include fields that exist)
        metadata = []
        
        if doc.get("type"):
            metadata.append(f"Type: {doc['type']}")
        
        if doc.get("site_name"):
            metadata.append(f"Site: {doc['site_name']}")
        
        if doc.get("date"):
            metadata.append(f"Date: {doc['date']}")
        
        if doc.get("status"):
            metadata.append(f"Status: {doc['status']}")
        
        # Build rich context entry with clear boundaries
        context_parts.append(f"""
{'=' * 60}
Document {i}
Source: {source}
{chr(10).join(metadata)}

Content:
{doc['text']}
{'=' * 60}
""")

    context = "\n\n".join(context_parts)

    # ============================================================
    # DEBUG: Print the FULL context to verify PDF text is included
    # ============================================================
    print("=" * 60)
    print("📄 FULL CONTEXT BEING SENT TO LLM:")
    print("-" * 60)
    print(context)
    print("=" * 60)
    print(f"📊 Context Statistics:")
    print(f"   Characters: {len(context)}")
    print(f"   Words: {len(context.split())}")
    print(f"   Documents: {len(results)}")
    print("=" * 60)

    # --------------------------------------------------
    # Strengthened Prompt
    # --------------------------------------------------
    prompt = f"""
You are SAFESIGHT AI, an expert construction safety assistant.

The retrieved context below contains documents relevant to the user's question.
Documents are ordered from highest to lowest relevance.
Prefer information from earlier documents when there are conflicts.

The context may contain:
- Inspection reports
- Safety manuals
- Or both

Instructions:
1. First determine which retrieved documents are relevant to the user's question.
2. Ignore unrelated retrieved documents.
3. If only inspection reports are relevant, answer from inspection reports.
4. If only manuals are relevant, answer from manuals.
5. If both are relevant, combine them naturally.
6. Quote or summarize only information that appears in the retrieved context.
7. If two retrieved documents conflict, prefer the higher-ranked document and mention the inconsistency if it affects the answer.
8. Never invent facts or make assumptions.
9. If the retrieved context does not contain enough information, clearly state that.

When answering from inspection reports:
- Treat each image as a separate inspection.
- Never combine workers or violations from different images.
- Mention the image name before describing its findings.
- Summarize findings for each image individually.
- Do not assume the same worker appears across different images.

When answering from safety manuals:
- Provide clear, actionable information.
- Present requirements in an organized format.

General Guidelines:
- Understand the user's intent before answering.
- Answer exactly what the user is asking.
- Keep the response focused, clear, and accurate.
- Present information in the format that best suits the question (paragraphs, bullet points, or tables).
- Do not repeat information.
- Do not add unrelated details.

Retrieved Context:
{context}

User Question:
{question}

Answer:
"""

    # ============================================================
    # DEBUG: Print the prompt being sent to LLM
    # ============================================================
    print("=" * 60)
    print("📝 PROMPT BEING SENT TO LLM (first 500 chars):")
    print("-" * 60)
    print(prompt[:500])
    print("..." if len(prompt) > 500 else "")
    print("=" * 60)

    response = llm.invoke(prompt)

    # --------------------------------------------------
    # Return Sources (Only Inspection Reports)
    # --------------------------------------------------
    sources = []

    for r in results:
        doc = r["document"]
        # Only include inspection reports (they have images)
        if doc.get("type") != "inspection":
            continue

        sources.append({
            "image": doc.get("image"),
            "status": doc.get("status"),
            "missing": doc.get("missing", []),
            "date": doc.get("date"),
            "site_name": doc.get("site_name"),
            "score": r.get("score", 0.0)
        })

    return {
        "answer": response.content,
        "sources": sources
    }


# --------------------------------------------------
# Standalone Testing
# --------------------------------------------------
if __name__ == "__main__":

    print("=" * 60)
    print("        SAFESIGHT RAG Assistant")
    print("=" * 60)
    print("Type 'exit' to quit.\n")

    while True:

        question = input("\nAsk: ")

        if question.lower() == "exit":
            break

        result = ask_question(question)

        print("\n" + "=" * 60)
        print("Answer:\n")
        print(result["answer"])

        print("\n" + "=" * 60)
        print("Retrieved Sources:\n")

        if result["sources"]:
            for source in result["sources"]:
                print(f"🖼️  Image    : {source['image']}")
                print(f"   Status   : {source['status']}")
                print(f"   Missing  : {', '.join(source['missing']) if source['missing'] else 'None'}")
                print(f"   Site     : {source['site_name']}")
                print(f"   Date     : {source['date']}")
                print(f"   Score    : {source['score']:.4f}")
                print("-" * 40)
        else:
            print("(No inspection reports in retrieved context)")

        print()