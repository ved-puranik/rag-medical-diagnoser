import os
# These libraries help us read the PDF and chop it into small pieces
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# These libraries let us talk to Ollama and store the data
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_ollama import ChatOllama
from langchain_classic.chains import RetrievalQA
# --- CONFIGURATION ---
PDF_FILE = "sample-data.pdf"
MODEL_NAME = "llama3"              # The "Talker"
EMBEDDING_MODEL = "nomic-embed-text" # The "Searcher"
DB_PATH = "./my_vector_db"         # Where we save the memory

def main():
    # 1. LOAD THE PDF
    print(f"📂 Reading {PDF_FILE}...")
    if not os.path.exists(PDF_FILE):
        print("❌ Error: guidelines.pdf not found!")
        return

    loader = PyPDFLoader(PDF_FILE)
    docs = loader.load()
    print(f"   ✅ Found {len(docs)} pages.")

    # 2. SPLIT TEXT (AI cannot read whole books at once, so we cut it into chunks)
    print("✂️  Cutting into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    print(f"   ✅ Created {len(splits)} text chunks.")

    # 3. EMBED & STORE (Turn text into numbers and save to database)
    print("💾 Saving to Vector Database (this might take a minute)...")
    vectorstore = Chroma.from_documents(
        documents=splits, 
        embedding=OllamaEmbeddings(model=EMBEDDING_MODEL),
        persist_directory=DB_PATH
    )
    print("   ✅ Knowledge Base built!")

    # 4. SETUP THE BRAIN
    print("🧠 Warming up Llama 3...")
    llm = ChatOllama(model=MODEL_NAME)
    
    # This chain connects the DB to the LLM
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm, 
        chain_type="stuff", 
        retriever=vectorstore.as_retriever(search_kwargs={"k": 6})
    )

    # 5. CHAT LOOP
    print("\n==========================================")
    print("🤖 RAG AGENT READY")
    print("   I have read your document.")
    print("   Ask me anything! (Type 'exit' to quit)")
    print("==========================================\n")

    while True:
        query = input("❓ Question: ")
        if query.lower() in ["exit", "quit"]:
            break
        
        print("   🔍 Searching & Thinking...")
        response = qa_chain.invoke({"query": query})
        print(f"\n💡 Answer: {response['result']}\n")
        print("-" * 40)

if __name__ == "__main__":
    main()