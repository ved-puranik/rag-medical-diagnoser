# Medi-Diagnoser Setup Guide

## Prerequisites

1. **Python 3.13+** installed
2. **Node.js 18+** and npm installed
3. **Ollama** installed and running
   - Download from: https://ollama.ai
   - After installation, pull required models:
     ```bash
     ollama pull llama3
     ollama pull nomic-embed-text
     ```

## Backend Setup (`medi-backend/`)

1. Navigate to the backend directory:
   ```bash
   cd medi-backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Download spaCy language model (required by Presidio):
   ```bash
   python -m spacy download en_core_web_lg
   ```

5. Start the FastAPI server:
   ```bash
   uvicorn api:app --reload --port 8000
   ```

   The server will be available at `http://127.0.0.1:8000`

## Frontend Setup (`medi-frontend/`)

1. Navigate to the frontend directory:
   ```bash
   cd medi-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000`

## Features

### Audio Analysis (Existing)
- Upload MP3/WAV files via the "New Diagnosis" page
- Automatically transcribes, redacts PII, and generates SOAP notes

### RAG Knowledge Base (New)
- Navigate to "RAG Knowledge Base" in the sidebar
- Upload PDF documents (medical guidelines, research papers, etc.)
- Ask questions about your documents using AI-powered retrieval

## Troubleshooting

### Backend Issues

**"ModuleNotFoundError" for langchain packages:**
- Ensure you've installed all requirements: `pip install -r requirements.txt`

**"Ollama connection error":**
- Make sure Ollama is running: Check if `ollama list` works in terminal
- Verify models are downloaded: `ollama list` should show `llama3` and `nomic-embed-text`

**"spacy model not found":**
- Run: `python -m spacy download en_core_web_lg`

### Frontend Issues

**"Cannot connect to backend":**
- Ensure backend is running on port 8000
- Check CORS settings in `api.py` if running on different ports

**"Module not found" errors:**
- Run: `npm install` to ensure all dependencies are installed

## API Endpoints

### Audio Analysis
- `POST /analyze` - Upload audio file for transcription and SOAP note generation

### RAG System
- `GET /rag/status` - Check RAG system status
- `POST /rag/upload-pdf` - Upload PDF for processing
- `POST /rag/query` - Query the knowledge base

## Notes

- The RAG vector database is stored locally in `medi-backend/rag_vector_db/`
- Audio files are processed temporarily and deleted after analysis
- All processing happens locally - no data is sent to external services (except gTTS for test audio)
- Each user will have their own vector database (not shared between installations)

