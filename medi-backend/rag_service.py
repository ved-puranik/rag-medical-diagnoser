"""
RAG Service — Contextual Metadata + BM25 Re-ranking.

Pipeline:
  1. Load PDF with PyPDFLoader (page metadata auto-attached).
  2. Split into chunks; stamp each chunk with source_file + page.
  3. Embed via nomic-embed-text and persist to ChromaDB.
  4. At query time: retrieve top-RETRIEVAL_K candidates, re-rank via BM25,
     keep top-RERANK_TOP_K, build annotated context, call Llama3 directly.
"""
import os
from collections import Counter
from typing import Any, Dict, List, Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

MODEL_NAME = "llama3"
EMBEDDING_MODEL = "nomic-embed-text"
DB_PATH = "./data/rag_vector_db"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
RETRIEVAL_K = 10   # wider candidate pool fetched from ChromaDB
RERANK_TOP_K = 6   # final set passed to the LLM after re-ranking


class RAGService:
    """Manages PDF ingestion, vector storage, and context-aware querying."""

    def __init__(self) -> None:
        self.vectorstore: Optional[Chroma] = None
        self.is_ready = False

    # ------------------------------------------------------------------
    # Ingestion
    # ------------------------------------------------------------------

    def initialize_vectorstore(self, pdf_path: str) -> Dict[str, Any]:
        try:
            if not os.path.exists(pdf_path):
                return {"success": False, "error": f"PDF file not found: {pdf_path}"}

            loader = PyPDFLoader(pdf_path)
            docs = loader.load()

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=CHUNK_SIZE,
                chunk_overlap=CHUNK_OVERLAP,
            )
            splits = splitter.split_documents(docs)

            # Stamp every chunk with the originating filename.
            # PyPDFLoader already writes doc.metadata["page"] (0-indexed int).
            source_name = os.path.basename(pdf_path)
            for chunk in splits:
                chunk.metadata["source_file"] = source_name

            self.vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=OllamaEmbeddings(model=EMBEDDING_MODEL),
                persist_directory=DB_PATH,
            )
            self.is_ready = True

            return {
                "success": True,
                "pages": len(docs),
                "chunks": len(splits),
                "message": "Vector store initialized successfully",
            }

        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def load_existing_vectorstore(self) -> bool:
        try:
            if os.path.exists(DB_PATH) and os.listdir(DB_PATH):
                self.vectorstore = Chroma(
                    persist_directory=DB_PATH,
                    embedding_function=OllamaEmbeddings(model=EMBEDDING_MODEL),
                )
                self.is_ready = True
                return True
            return False
        except Exception as exc:
            print(f"Error loading existing vectorstore: {exc}")
            return False

    # ------------------------------------------------------------------
    # Re-ranking
    # ------------------------------------------------------------------

    def _bm25_rerank(
        self, query: str, documents: List[Document], top_k: int
    ) -> List[Document]:
        """
        Score each document with a BM25 term-frequency formula and return
        the top_k highest-scoring documents.

        BM25 TF component:
            tf_bm25(t, d) = tf(t,d) * (k1 + 1) / (tf(t,d) + k1*(1 - b + b*|d|/avgdl))
        """
        if len(documents) <= top_k:
            return documents

        query_terms = query.lower().split()
        doc_lengths = [len(doc.page_content.split()) for doc in documents]
        avg_dl = sum(doc_lengths) / len(doc_lengths)

        k1, b = 1.5, 0.75
        scored: List[tuple] = []

        for doc, dl in zip(documents, doc_lengths):
            freq = Counter(doc.page_content.lower().split())
            score = 0.0
            for term in query_terms:
                tf = freq.get(term, 0)
                if tf:
                    score += (tf * (k1 + 1)) / (
                        tf + k1 * (1 - b + b * dl / avg_dl)
                    )
            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored[:top_k]]

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def query(self, question: str) -> Dict[str, Any]:
        if not self.is_ready or self.vectorstore is None:
            return {
                "success": False,
                "error": "RAG system not initialized. Please upload a PDF first.",
            }
        try:
            # 1. Retrieve wider candidate pool via cosine similarity.
            raw_docs = self.vectorstore.similarity_search(question, k=RETRIEVAL_K)

            # 2. Re-rank by BM25 keyword relevance; keep best RERANK_TOP_K.
            top_docs = self._bm25_rerank(question, raw_docs, top_k=RERANK_TOP_K)

            # 3. Build annotated context string (source + page per block).
            context_blocks = []
            for doc in top_docs:
                source = doc.metadata.get("source_file", "unknown")
                # PyPDFLoader uses 0-indexed pages; display as 1-indexed.
                page_raw = doc.metadata.get("page", None)
                page_label = (page_raw + 1) if isinstance(page_raw, int) else "N/A"
                context_blocks.append(
                    f"[Source: {source}, Page {page_label}]\n{doc.page_content}"
                )
            context = "\n\n---\n\n".join(context_blocks)

            # 4. Call Llama3 with curated context directly — no RetrievalQA chain.
            llm = ChatOllama(model=MODEL_NAME)
            prompt = (
                "You are a medical knowledge assistant. "
                "Answer the question using ONLY the context provided below. "
                "If the answer cannot be found in the context, say so explicitly.\n\n"
                f"Context:\n{context}\n\n"
                f"Question: {question}\n\n"
                "Answer:"
            )
            response = llm.invoke(prompt)
            answer = (
                response.content
                if hasattr(response, "content")
                else str(response)
            )

            return {
                "success": True,
                "answer": answer,
                "question": question,
                "sources": [
                    {
                        "source_file": d.metadata.get("source_file", "unknown"),
                        "page": (
                            (d.metadata["page"] + 1)
                            if isinstance(d.metadata.get("page"), int)
                            else "N/A"
                        ),
                    }
                    for d in top_docs
                ],
            }

        except Exception as exc:
            return {"success": False, "error": str(exc)}

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_ready": self.is_ready,
            "has_vectorstore": self.vectorstore is not None,
            "has_qa_chain": False,
            "db_path": DB_PATH,
            "db_exists": os.path.exists(DB_PATH),
        }


# Module-level singleton — imported by api.py.
rag_service = RAGService()


def initialize_rag_service() -> None:
    """Called once at FastAPI startup; re-hydrates vectorstore from disk if present."""
    rag_service.load_existing_vectorstore()
