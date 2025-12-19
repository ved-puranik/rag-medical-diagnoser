"""
RAG Service Module
Handles PDF processing, vector store management, and query processing for the RAG system.
"""
import os
from typing import Optional, Dict, Any
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import RetrievalQA

# Configuration
MODEL_NAME = "llama3"
EMBEDDING_MODEL = "nomic-embed-text"
DB_PATH = "./rag_vector_db"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
SEARCH_K = 6

class RAGService:
    """Service class for managing RAG operations."""
    
    def __init__(self):
        self.vectorstore: Optional[Chroma] = None
        self.qa_chain: Optional[RetrievalQA] = None
        self.is_ready = False
        
    def initialize_vectorstore(self, pdf_path: str) -> Dict[str, Any]:
        """
        Initialize the vector store from a PDF file.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dictionary with status and metadata
        """
        try:
            # 1. Load PDF
            if not os.path.exists(pdf_path):
                return {
                    "success": False,
                    "error": f"PDF file not found: {pdf_path}"
                }
            
            loader = PyPDFLoader(pdf_path)
            docs = loader.load()
            
            # 2. Split text into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=CHUNK_SIZE,
                chunk_overlap=CHUNK_OVERLAP
            )
            splits = text_splitter.split_documents(docs)
            
            # 3. Create or update vector store
            self.vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=OllamaEmbeddings(model=EMBEDDING_MODEL),
                persist_directory=DB_PATH
            )
            
            # 4. Initialize QA chain
            llm = ChatOllama(model=MODEL_NAME)
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=llm,
                chain_type="stuff",
                retriever=self.vectorstore.as_retriever(search_kwargs={"k": SEARCH_K})
            )
            
            self.is_ready = True
            
            return {
                "success": True,
                "pages": len(docs),
                "chunks": len(splits),
                "message": "Vector store initialized successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def load_existing_vectorstore(self) -> bool:
        """
        Load an existing vector store from disk.
        
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            if os.path.exists(DB_PATH) and os.listdir(DB_PATH):
                self.vectorstore = Chroma(
                    persist_directory=DB_PATH,
                    embedding_function=OllamaEmbeddings(model=EMBEDDING_MODEL)
                )
                
                llm = ChatOllama(model=MODEL_NAME)
                self.qa_chain = RetrievalQA.from_chain_type(
                    llm=llm,
                    chain_type="stuff",
                    retriever=self.vectorstore.as_retriever(search_kwargs={"k": SEARCH_K})
                )
                
                self.is_ready = True
                return True
            return False
        except Exception as e:
            print(f"Error loading existing vectorstore: {e}")
            return False
    
    def query(self, question: str) -> Dict[str, Any]:
        """
        Query the RAG system.
        
        Args:
            question: The question to ask
            
        Returns:
            Dictionary with answer and metadata
        """
        if not self.is_ready or self.qa_chain is None:
            return {
                "success": False,
                "error": "RAG system not initialized. Please upload a PDF first."
            }
        
        try:
            response = self.qa_chain.invoke({"query": question})
            return {
                "success": True,
                "answer": response.get("result", ""),
                "question": question
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the RAG system.
        
        Returns:
            Dictionary with status information
        """
        return {
            "is_ready": self.is_ready,
            "has_vectorstore": self.vectorstore is not None,
            "has_qa_chain": self.qa_chain is not None,
            "db_path": DB_PATH,
            "db_exists": os.path.exists(DB_PATH) if DB_PATH else False
        }

# Global instance
rag_service = RAGService()

# Try to load existing vectorstore on module import
def initialize_rag_service():
    """Initialize the RAG service and try to load existing vectorstore."""
    rag_service.load_existing_vectorstore()

