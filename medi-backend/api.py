from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import whisper
import ollama
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
import os
import shutil
from rag_service import rag_service, initialize_rag_service

app = FastAPI()

# --- CORS CONFIGURATION ---
# This allows your Next.js frontend (running on a different port) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LOAD MODELS AT STARTUP ---
print("⏳ Loading Whisper model...")
audio_model = whisper.load_model("base")
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()
print("✅ Models loaded and ready!")

# --- INITIALIZE RAG SERVICE ---
print("⏳ Initializing RAG service...")
initialize_rag_service()
print("✅ RAG service initialized!")

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    try:
        # 1. Save uploaded file temporarily
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Transcribe (Whisper)
        print(f"🎤 Transcribing {temp_filename}...")
        result = audio_model.transcribe(temp_filename)
        raw_text = result["text"]

        # 3. Redact (Presidio)
        analysis_results = analyzer.analyze(text=raw_text, language='en')
        redacted_result = anonymizer.anonymize(
            text=raw_text,
            analyzer_results=analysis_results
        )
        safe_text = redacted_result.text

        # 4. Summarize (Ollama)
        print("🧠 Sending to Llama 3...")
        prompt = f"""
        You are a medical scribe. Create a SOAP note.
        Do NOT use real names.
        Input: "{safe_text}"
        """
        response = ollama.chat(model="llama3", messages=[
            {'role': 'user', 'content': prompt},
        ])
        soap_note = response['message']['content']

        # Cleanup
        os.remove(temp_filename)

        # 5. Return JSON to Frontend
        return {
            "raw_transcription": raw_text,
            "redacted_text": safe_text,
            "soap_note": soap_note
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- RAG ENDPOINTS ---

class QueryRequest(BaseModel):
    question: str

@app.get("/rag/status")
async def get_rag_status():
    """Get the status of the RAG system."""
    status = rag_service.get_status()
    return status

@app.post("/rag/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload and process a PDF file for RAG.
    """
    try:
        # Save uploaded file temporarily
        temp_filename = f"temp_rag_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process PDF and initialize vectorstore
        result = rag_service.initialize_vectorstore(temp_filename)
        
        # Cleanup temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to process PDF"))
        
        return {
            "success": True,
            "message": result.get("message", "PDF processed successfully"),
            "pages": result.get("pages", 0),
            "chunks": result.get("chunks", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/query")
async def query_rag(request: QueryRequest):
    """
    Query the RAG system with a question.
    """
    try:
        result = rag_service.query(request.question)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Query failed"))
        
        return {
            "success": True,
            "answer": result.get("answer", ""),
            "question": result.get("question", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))