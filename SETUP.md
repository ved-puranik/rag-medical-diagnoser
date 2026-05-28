<div align="center">

# 🩺 Medi-Diagnoser

### Privacy-first AI medical scribe — 100% local, zero cloud dependency

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Ollama](https://img.shields.io/badge/Ollama-Llama_3-FF6B6B?style=flat-square)](https://ollama.ai)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## Overview

Medi-Diagnoser is a full-stack AI application that converts patient-doctor audio recordings into structured **SOAP clinical notes** — with automatic PII redaction, persistent session history, and a retrieval-augmented medical knowledge base — without sending a single byte of patient data to an external server.

The entire AI pipeline (speech-to-text, PII scrubbing, LLM inference, semantic search) runs **on your local machine**.

---

## Features

### 🔒 Privacy-First by Design
Transcribed text is stripped of all personally identifiable information by **Microsoft Presidio** before it reaches any language model. Names, phone numbers, dates of birth, and addresses are replaced with typed placeholders (`<PERSON>`, `<DATE_TIME>`, etc.) and visually highlighted in the redacted transcript tab.

### ⚡ Asynchronous Processing Pipeline
Submitting an audio file returns a `session_id` in under 200 ms. The heavy pipeline — **OpenAI Whisper** (transcription) → **Presidio** (PII redaction) → **Llama 3** (SOAP generation) — runs as a background thread via FastAPI `BackgroundTasks`, keeping the server responsive. The frontend polls `GET /sessions/{id}` every 3.5 seconds, animating a three-step progress tracker, and automatically renders results the moment they're ready.

### 🧠 RAG Medical Knowledge Base with Re-ranking
Upload any PDF (clinical guidelines, drug formularies, research papers) and build a persistent **ChromaDB** vector store embedded with `nomic-embed-text`. At query time the pipeline:
1. Retrieves the **top 10** candidate chunks by cosine similarity.
2. Re-ranks them with a **BM25 term-frequency scoring algorithm** (no extra dependencies).
3. Forwards the best **6** annotated context blocks — tagged with source filename and page number — directly to Llama 3.
4. Returns the answer alongside clickable source citation chips: `📄 Guidelines.pdf (Page 4)`.

### 📋 Persistent Session History
Every clinical session is stored in a local **SQLite** database via **SQLAlchemy 2.0**. A live session history panel in the right sidebar displays all past sessions sorted by date, each with a status badge (Running / Done) and a shortened session ID. Clicking any completed session restores the full three-tab view instantly — no re-processing required.

### 🐳 One-Command Docker Deployment
A multi-stage Next.js Dockerfile (deps → build → minimal runner) and a production-ready Python backend Dockerfile are coordinated by a single `docker-compose.yml`. Whisper's base model and the spaCy language model are pre-downloaded during the image build, eliminating cold-start delays at runtime.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                 │
│                                                                           │
│  Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Lucide Icons    │
│                                                                           │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────────────┐   │
│  │  FileUpload  │  │  ProgressStepper │  │    ResultsDashboard       │   │
│  │  drag & drop │  │  (simulated +    │  │  SOAP │ Redacted │ Raw    │   │
│  │  MP3/WAV/M4A │  │   poll-driven)   │  │  Copy  ·  PII chips       │   │
│  └─────────────┘  └──────────────────┘  └───────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  SessionHistory sidebar  (live refresh · status badges)          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ Axios  (HTTP / JSON)
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    FastAPI  ·  Uvicorn  (Port 8000)                       │
│                                                                           │
│  POST /analyze                                                            │
│    └─► BackgroundTask ──► Whisper → Presidio → Llama 3                  │
│  GET  /sessions           ← sorted session list                          │
│  GET  /sessions/{id}      ← full session detail                          │
│  POST /rag/upload-pdf  ──► PyPDFLoader → Splitter → Embed → ChromaDB    │
│  POST /rag/query       ──► cosine k=10 → BM25 re-rank → Llama 3        │
│  GET  /rag/status                                                         │
└──────────┬──────────────────────┬───────────────────────┬────────────────┘
           │                      │                       │
     ┌─────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐
     │   SQLite    │        │  ChromaDB   │        │   Ollama    │
     │ (SQLAlchemy)│        │ (LangChain) │        │  Llama 3 +  │
     │  sessions   │        │  RAG index  │        │  nomic-     │
     │  ./data/    │        │  ./data/    │        │  embed-text │
     └─────────────┘        └─────────────┘        └─────────────┘
```

---

## Quick Start — Docker *(Recommended)*

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin on Linux)
- [Ollama](https://ollama.ai) installed and running **on the host machine** (not inside Docker)

```bash
# 1 — Pull the AI models onto your host (one-time, ~5 GB total)
ollama pull llama3
ollama pull nomic-embed-text

# 2 — Clone the repository
git clone <repo-url>
cd rag-medical-diagnoser-1

# 3 — Build images and start services
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Interactive API docs | http://localhost:8000/docs |

> **Linux users:** `host.docker.internal` is not automatic on Linux. The `docker-compose.yml` already includes `extra_hosts: host-gateway` to handle this — no manual steps needed.

### Data Persistence

All runtime data lives in `./medi-backend/data/`, which is bind-mounted into the backend container.

| Host path | Container path | Contents |
|---|---|---|
| `./medi-backend/data/medi_scribe.db` | `/app/data/medi_scribe.db` | SQLite session database |
| `./medi-backend/data/rag_vector_db/` | `/app/data/rag_vector_db/` | ChromaDB vector index |

Stopping or removing containers does **not** delete data. To wipe everything:

```bash
docker compose down
rm -rf medi-backend/data/
```

---

## Manual Installation

### Prerequisites

| Dependency | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Ollama | latest | [ollama.ai](https://ollama.ai) |
| ffmpeg | any | `apt install ffmpeg` / `brew install ffmpeg` / [ffmpeg.org](https://ffmpeg.org) |

---

### Step 1 — Ollama

```bash
# Pull the models (one-time download, ~5 GB total)
ollama pull llama3
ollama pull nomic-embed-text
```

Verify Ollama is running:
```bash
ollama list   # should show both models
```

---

### Step 2 — Backend

```bash
cd medi-backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Download the spaCy NER model (required by Presidio for PII detection)
python -m spacy download en_core_web_lg

# Start the API server
uvicorn api:app --reload --port 8000
```

The server prints startup logs as Whisper and Presidio load, then:
```
INFO: Application startup complete.
```

---

### Step 3 — Frontend

```bash
cd medi-frontend

npm install
npm run dev
```

---

### Step 4 — Open the app

Navigate to **http://localhost:3000** and upload an audio file (MP3/WAV/M4A) on the **New Diagnosis** page.

> **Generating test audio:** Run `python medi-backend/make_audio.py` to create a sample patient recording at `medi-backend/test_audio.mp3` that contains deliberate PII for testing the redaction pipeline.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/analyze` | Upload audio → returns `{ session_id, status }` immediately |
| `GET` | `/sessions` | List all sessions with status, newest first |
| `GET` | `/sessions/{id}` | Full session detail (transcripts + SOAP note) |
| `GET` | `/rag/status` | Vector store readiness check |
| `POST` | `/rag/upload-pdf` | Ingest PDF → embed chunks → persist to ChromaDB |
| `POST` | `/rag/query` | Q&A against the knowledge base with source citations |

Full interactive documentation available at **http://localhost:8000/docs** (Swagger UI).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| HTTP client | Axios |
| API framework | FastAPI, Uvicorn |
| Data validation | Pydantic v2 |
| Database ORM | SQLAlchemy 2.0 · SQLite |
| Speech-to-text | OpenAI Whisper (`base` model, local) |
| PII detection & redaction | Microsoft Presidio + spaCy `en_core_web_lg` |
| LLM | Ollama · Llama 3 (local) |
| Embeddings | Ollama · nomic-embed-text (local) |
| Vector store | ChromaDB (persisted to disk) |
| RAG orchestration | LangChain Community + Core |
| Re-ranking | BM25 (custom implementation, no extra deps) |
| Containerisation | Docker · Docker Compose |

---

## Privacy & Compliance Notes

- **No external API calls** for clinical data. Whisper, Presidio, and Llama 3 all run on-device.
- PII is stripped **before** any LLM prompt is constructed — the model never sees real patient identifiers.
- Raw audio files are held in memory only for the duration of transcription and immediately deleted from disk.
- The session database and vector store are local files, never transmitted to a third party.
- Architecture designed with HIPAA-conscious principles: local processing, anonymisation-first, no persistent audio storage.

---

*Built with Python, TypeScript, and a commitment to patient data privacy.*
