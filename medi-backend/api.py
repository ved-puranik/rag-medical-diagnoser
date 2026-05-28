import os
import shutil
import uuid

import ollama
import whisper
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import ClinicalSession, SessionLocal, get_db, init_db
from rag_service import initialize_rag_service, rag_service

app = FastAPI(title="Medi-Diagnoser API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LOAD MODELS AT MODULE LEVEL ---
# These are shared across all requests; Whisper and Presidio are thread-safe for inference.
print("Loading Whisper model...")
audio_model = whisper.load_model("base")
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()
print("Models loaded and ready!")

print("Initializing RAG service...")
initialize_rag_service()
print("RAG service initialized!")


# --- STARTUP ---

@app.on_event("startup")
def on_startup() -> None:
    init_db()
    print("Database initialized.")


# --- BACKGROUND PIPELINE ---
# Defined as a plain sync function so Starlette's BackgroundTask runner
# automatically dispatches it to a thread-pool worker (via run_in_threadpool),
# keeping the async event loop free while Whisper/Ollama run.

def _run_analysis_pipeline(session_id: str, temp_filename: str) -> None:
    db = SessionLocal()
    try:
        print(f"[{session_id}] Transcribing...")
        result = audio_model.transcribe(temp_filename)
        raw_text = result["text"]

        print(f"[{session_id}] Redacting PII...")
        analysis_results = analyzer.analyze(text=raw_text, language="en")
        redacted_result = anonymizer.anonymize(
            text=raw_text, analyzer_results=analysis_results
        )
        safe_text = redacted_result.text

        print(f"[{session_id}] Generating SOAP note...")
        prompt = (
            'You are a medical scribe. Create a SOAP note. '
            'Do NOT use real names. '
            f'Input: "{safe_text}"'
        )
        response = ollama.chat(
            model="llama3",
            messages=[{"role": "user", "content": prompt}],
        )
        soap_note = response["message"]["content"]

        row = db.query(ClinicalSession).filter(ClinicalSession.id == session_id).first()
        if row:
            row.raw_transcript = raw_text
            row.redacted_transcript = safe_text
            row.soap_note = soap_note
            db.commit()
            print(f"[{session_id}] Pipeline complete — DB updated.")

    except Exception as exc:
        print(f"[{session_id}] Pipeline error: {exc}")
        row = db.query(ClinicalSession).filter(ClinicalSession.id == session_id).first()
        if row:
            row.raw_transcript = "Error during processing."
            row.redacted_transcript = "Error during processing."
            row.soap_note = f"Processing failed: {exc}"
            db.commit()
    finally:
        db.close()
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


# --- AUDIO PIPELINE ENDPOINT ---

@app.post("/analyze")
async def analyze_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    session_id = str(uuid.uuid4())
    temp_filename = f"temp_{session_id}_{file.filename}"

    # Persist the upload before returning so the background task can find it.
    contents = await file.read()
    with open(temp_filename, "wb") as buf:
        buf.write(contents)

    # Insert a placeholder row so the session is immediately queryable.
    new_session = ClinicalSession(
        id=session_id,
        raw_transcript="Processing...",
        redacted_transcript="Processing...",
        soap_note="Processing...",
    )
    db.add(new_session)
    db.commit()

    # Enqueue the CPU-bound pipeline as a background thread.
    background_tasks.add_task(_run_analysis_pipeline, session_id, temp_filename)

    return {"session_id": session_id, "status": "Processing"}


# --- SESSION HISTORY ENDPOINTS ---

@app.get("/sessions")
async def list_sessions(db: Session = Depends(get_db)):
    rows = (
        db.query(ClinicalSession)
        .order_by(ClinicalSession.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "status": "processing" if r.soap_note == "Processing..." else "completed",
        }
        for r in rows
    ]


@app.get("/sessions/{session_id}")
async def get_session(session_id: str, db: Session = Depends(get_db)):
    row = (
        db.query(ClinicalSession)
        .filter(ClinicalSession.id == session_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": row.id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "raw_transcript": row.raw_transcript,
        "redacted_transcript": row.redacted_transcript,
        "soap_note": row.soap_note,
        "status": "processing" if row.soap_note == "Processing..." else "completed",
    }


# --- RAG ENDPOINTS ---

class QueryRequest(BaseModel):
    question: str


@app.get("/rag/status")
async def get_rag_status():
    return rag_service.get_status()


@app.post("/rag/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        temp_filename = f"temp_rag_{file.filename}"
        contents = await file.read()
        with open(temp_filename, "wb") as buf:
            buf.write(contents)

        result = rag_service.initialize_vectorstore(temp_filename)

        if os.path.exists(temp_filename):
            os.remove(temp_filename)

        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to process PDF"),
            )

        return {
            "success": True,
            "message": result.get("message", "PDF processed successfully"),
            "pages": result.get("pages", 0),
            "chunks": result.get("chunks", 0),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/rag/query")
async def query_rag(request: QueryRequest):
    try:
        result = rag_service.query(request.question)

        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Query failed"),
            )

        return {
            "success": True,
            "answer": result.get("answer", ""),
            "question": result.get("question", ""),
            "sources": result.get("sources", []),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
