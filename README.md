<div align="center">

<br />

# 🩺 Medi-Diagnoser

### A production-grade, privacy-first AI medical scribe and knowledge-base system
### Built to run 100 % locally — no patient data ever leaves your network

<br />

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Ollama](https://img.shields.io/badge/Ollama-Llama_3-FF6B6B?style=for-the-badge)](https://ollama.ai)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)

<br />

> Upload a patient-doctor audio recording. Get a redacted transcript, a structured SOAP clinical note,
> and a searchable medical knowledge base — entirely on your own hardware.

<br />

</div>

---

## Table of Contents

- [Overview](#overview)
- [Core Technical Features](#core-technical-features)
- [System Architecture](#system-architecture)
- [Quick Start — Docker](#quick-start--docker-recommended)
- [Manual Installation](#manual-installation)
- [API Reference](#api-reference)
- [Tech Stack](#tech-stack)
- [Privacy & Security Model](#privacy--security-model)
- [Project Structure](#project-structure)

---

## Overview

Medi-Diagnoser is a full-stack AI application that solves a real clinical workflow problem: **turning unstructured patient-doctor conversations into structured, actionable medical documentation** — automatically, securely, and without any cloud dependency.

The system pipelines **OpenAI Whisper** (local speech-to-text) → **Microsoft Presidio** (automated PII redaction) → **Ollama Llama 3** (SOAP note generation) into a single HTTP request that returns a `session_id` immediately. A background thread pool worker handles the heavy inference work asynchronously, while the React frontend polls for completion and animates progress in real time.

A second mode provides a **RAG (Retrieval-Augmented Generation) knowledge base**: upload any medical PDF — clinical guidelines, drug formularies, research papers — and query it with natural language. The system retrieves candidate passages from a local **ChromaDB** vector store, re-ranks them with a **custom BM25 algorithm**, and forwards the best context directly to Llama 3, citing the source document and page number for every answer.

Every session is persisted to a local **SQLite database** via SQLAlchemy 2.0. A live session history sidebar lets clinicians restore any previous transcript and SOAP note instantly.

The entire stack ships as two Docker containers orchestrated by a single `docker compose up --build` command.

---

## Core Technical Features

### ⚡ Asynchronous Pipeline Offloading
The `POST /analyze` endpoint returns a `{"session_id": "...", "status": "Processing"}` response in under 200 ms, regardless of audio length. The CPU-intensive pipeline — Whisper transcription, Presidio PII scan, and Ollama inference — is dispatched to a **Starlette thread-pool worker** via `BackgroundTasks`. Because the background function is a plain synchronous callable (not a coroutine), Starlette's `run_in_threadpool` wrapper automatically moves it off the async event loop, keeping the server fully responsive under concurrent load. The frontend polls `GET /sessions/{id}` at 3.5-second intervals and renders results the moment the database row is updated.

### 🔒 Automated PII Redaction
**Microsoft Presidio's** `AnalyzerEngine` runs Named Entity Recognition (via spaCy `en_core_web_lg`) plus pattern-matching rules against the raw transcript before any LLM prompt is constructed. Detected entities — `PERSON`, `PHONE_NUMBER`, `DATE_TIME`, `LOCATION`, and others — are replaced with typed angle-bracket placeholders by `AnonymizerEngine`. The frontend's **Redacted Transcript** tab visually highlights every replaced token as an amber-colored chip. The LLM only ever sees the anonymised text; real patient identifiers never appear in a prompt.

### 🧠 Hybrid RAG Search with BM25 Re-ranking
PDF ingestion uses LangChain's `PyPDFLoader` + `RecursiveCharacterTextSplitter` (1 000-char chunks, 200-char overlap) to produce page-aware document fragments. Each chunk is stamped with `source_file` and `page` metadata before being embedded with **nomic-embed-text** and stored in a persistent **ChromaDB** collection.

At query time the retrieval pipeline runs in two stages:
1. **Cosine similarity** — ChromaDB returns the top **k = 10** candidate chunks ranked by embedding distance.
2. **BM25 re-ranking** — a custom `_bm25_rerank()` method scores each candidate with the classic BM25 term-frequency formula (`k1 = 1.5`, `b = 0.75`, per-document length normalisation) and selects the top **6** highest-scoring passages.

The six context blocks are assembled with inline source citations (`[Source: guidelines.pdf, Page 4]`) and injected directly into the Llama 3 prompt. Every answer in the UI is accompanied by clickable source-attribution chips.

### 📋 Persistent Session History
All clinical sessions are written to a **SQLite database** (`./data/medi_scribe.db`) via **SQLAlchemy 2.0**. The `ClinicalSession` model stores `id` (UUID), `created_at`, `raw_transcript`, `redacted_transcript`, and `soap_note`. A live session history panel on the main dashboard fetches `GET /sessions` on mount and on every new submission, displaying sessions with status badges (Running / Done), short UUIDs, and timestamps. Clicking any completed session restores the full three-tab results view — no re-transcription required.

### 🐳 Turnkey Dockerisation
The backend image (`python:3.11-slim`) pre-downloads the Whisper base model (~150 MB) and the spaCy `en_core_web_lg` model during the `docker build` step, eliminating cold-start latency at container runtime. The frontend uses a **three-stage build** (deps → builder → runner) with Next.js `output: "standalone"`, reducing the final image from ~1.5 GB to ~200 MB. A single `docker-compose.yml` coordinates both services, exposes the Ollama host via `host.docker.internal` (with a Linux `host-gateway` fallback), and provides a healthcheck-gated startup dependency so the frontend only comes up after the backend has finished loading its models.

---

## System Architecture

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                            USER BROWSER                                      ║
║                                                                              ║
║  Next.js 16 · React 19 · TypeScript · Tailwind CSS v4                       ║
║                                                                              ║
║  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────────────────┐ ║
║  │  FileUpload   │  │  ProgressStepper  │  │     ResultsDashboard         │ ║
║  │  (drag & drop)│  │  3-step animated  │  │  SOAP │ Redacted │ Raw       │ ║
║  │  MP3 / WAV   │  │  + poll at 3.5 s  │  │  Copy · PII highlight chips  │ ║
║  └──────────────┘  └───────────────────┘  └──────────────────────────────┘ ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │  SessionHistory  (live sidebar · status badges · click-to-restore)   │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │  RAG Page  (PDF upload · Q&A input · source citation chips)          │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
╚════════════════════════════╦═════════════════════════════════════════════════╝
                             ║  Axios  (multipart / JSON)
                             ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                   FastAPI  +  Uvicorn  —  Port 8000                          ║
║                                                                              ║
║  POST /analyze ──────────────────────────────────────────────────────────   ║
║    ├─ writes placeholder row to SQLite                                       ║
║    ├─ returns { session_id, status: "Processing" }  ←── < 200 ms            ║
║    └─ dispatches to Starlette thread-pool ──────────────────────────────    ║
║                                             │                                ║
║                       ┌─────────────────────▼───────────────────────┐       ║
║                       │        Background Thread Worker              │       ║
║                       │                                              │       ║
║                       │  1. Whisper  ──► raw transcript              │       ║
║                       │  2. Presidio ──► redacted transcript         │       ║
║                       │  3. Llama 3  ──► SOAP note                   │       ║
║                       │  4. SQLAlchemy ─► UPDATE clinical_sessions   │       ║
║                       └──────────────────────────────────────────────┘       ║
║                                                                              ║
║  GET  /sessions            ──► ORDER BY created_at DESC                     ║
║  GET  /sessions/{id}       ──► full row                                     ║
║  POST /rag/upload-pdf ──► PyPDFLoader → Splitter → Embed → ChromaDB         ║
║  POST /rag/query      ──► cosine k=10 → BM25 re-rank → top-6 → Llama 3    ║
║  GET  /rag/status          ──► vectorstore readiness                        ║
╚═══════════╦════════════════════════╦══════════════════════╦══════════════════╝
            ║                        ║                      ║
     ┌──────▼───────┐        ┌───────▼──────┐      ┌───────▼──────────────┐
     │    SQLite     │        │   ChromaDB   │      │  Ollama  (on host)   │
     │  SQLAlchemy   │        │ (LangChain)  │      │                      │
     │  2.0 ORM      │        │ persisted at │      │  llama3              │
     │               │        │ ./data/      │      │  nomic-embed-text    │
     │  ./data/      │        │ rag_vector_  │      │                      │
     │  medi_        │        │ db/          │      │  host.docker.        │
     │  scribe.db    │        │              │      │  internal:11434      │
     └───────────────┘        └──────────────┘      └──────────────────────┘
```

---

## Quick Start — Docker *(Recommended)*

### Prerequisites

| Requirement | Purpose |
|---|---|
| [Docker Desktop](https://docker.com/products/docker-desktop) | Runs both containers |
| [Ollama](https://ollama.ai) | LLM inference on the **host machine** |

> **Why isn't Ollama containerised?** Ollama requires GPU passthrough or large CPU resources. Running it natively on the host lets it use hardware acceleration out of the box. The backend container reaches it via `http://host.docker.internal:11434`, a DNS alias Docker provides for host-to-container communication.

```bash
# Step 1 — Pull AI models onto your host machine (one-time, ~5 GB)
ollama pull llama3
ollama pull nomic-embed-text

# Step 2 — Clone the repository
git clone https://github.com/vap-dev07/rag-medical-diagnoser.git
cd rag-medical-diagnoser

# Step 3 — Build images and start services (~10–15 min on first build)
docker compose up --build
```

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:8000 |
| **Interactive Docs** | http://localhost:8000/docs |

> **Linux note:** `host.docker.internal` is not automatic on Linux. The `docker-compose.yml` already includes `extra_hosts: host-gateway` — no manual configuration needed.

### Persistent Data

All runtime data is bind-mounted to `./medi-backend/data/` on your host. Destroying or rebuilding containers does **not** delete your sessions or knowledge base.

```
./medi-backend/data/
├── medi_scribe.db       ← SQLite clinical session history
└── rag_vector_db/       ← ChromaDB vector index
```

To start completely fresh: `docker compose down && rm -rf medi-backend/data/`

---

## Manual Installation

For developers who want to modify the code or run without Docker.

### Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| Ollama | latest | Must be running as a background service |
| ffmpeg | any | Required by Whisper for audio decoding |

### Step 1 — Ollama Models

```bash
ollama pull llama3
ollama pull nomic-embed-text

# Verify both are available
ollama list
```

### Step 2 — Backend

```bash
cd medi-backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt

# Download the spaCy NER model (required by Presidio)
python -m spacy download en_core_web_lg

# Launch the FastAPI server with hot-reload
uvicorn api:app --reload --port 8000
```

On first launch, Whisper and Presidio initialise (20–40 s). Once you see `Application startup complete`, the server is ready at **http://127.0.0.1:8000**.

> **Test audio:** Run `python make_audio.py` to generate a sample recording (`test_audio.mp3`) containing deliberate PII — useful for testing the redaction pipeline end-to-end.

### Step 3 — Frontend

```bash
cd medi-frontend

npm install
npm run dev
```

Frontend is available at **http://localhost:3000**.

---

## API Reference

### Audio Pipeline

| Method | Endpoint | Payload | Response |
|---|---|---|---|
| `POST` | `/analyze` | `multipart/form-data` — `file` (audio) | `{ session_id, status: "Processing" }` |
| `GET` | `/sessions` | — | `[{ id, created_at, status }]` sorted newest-first |
| `GET` | `/sessions/{id}` | — | `{ id, created_at, raw_transcript, redacted_transcript, soap_note, status }` |

**Status values:** `"processing"` while the background worker is running; `"completed"` once all three stages finish and the database row is updated.

### RAG Knowledge Base

| Method | Endpoint | Payload | Response |
|---|---|---|---|
| `GET` | `/rag/status` | — | `{ is_ready, has_vectorstore, db_exists }` |
| `POST` | `/rag/upload-pdf` | `multipart/form-data` — `file` (PDF) | `{ success, message, pages, chunks }` |
| `POST` | `/rag/query` | `{ "question": "..." }` | `{ success, answer, question, sources[] }` |

**Source object:** `{ source_file: string, page: number }` — one entry per re-ranked context block passed to the LLM.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend framework** | Next.js 16 (standalone output) | Server-side rendering, routing, Docker-optimised build |
| **UI library** | React 19 + TypeScript | Component model, type safety |
| **Styling** | Tailwind CSS v4 | Utility-first design system |
| **Icons** | Lucide React | Consistent icon set |
| **HTTP client** | Axios | API calls, multipart file upload |
| **API framework** | FastAPI + Pydantic v2 | Async endpoints, request validation, OpenAPI docs |
| **ASGI server** | Uvicorn | Production-grade async server |
| **Database ORM** | SQLAlchemy 2.0 | Declarative models, session management |
| **Database** | SQLite | Zero-dependency local persistence |
| **Speech-to-text** | OpenAI Whisper (`base`) | Local CPU-compatible audio transcription |
| **PII redaction** | Microsoft Presidio | NER-based entity detection + anonymisation |
| **NLP engine** | spaCy `en_core_web_lg` | Powers Presidio's Named Entity Recognition |
| **LLM** | Ollama · Llama 3 | Local inference, SOAP note generation, RAG Q&A |
| **Embeddings** | Ollama · nomic-embed-text | Semantic vector generation for RAG |
| **Vector store** | ChromaDB | Cosine similarity search, persistent on-disk index |
| **RAG framework** | LangChain Community + Core | PDF loading, text splitting, vector store integration |
| **Re-ranking** | Custom BM25 | Term-frequency re-ranking over cosine candidates |
| **Containerisation** | Docker + Docker Compose | Multi-stage builds, volume persistence, healthchecks |

---

## Privacy & Security Model

| Concern | Implementation |
|---|---|
| **No external API calls** | Whisper, Presidio, and Llama 3 all run on-device via Ollama. Zero patient data transmitted externally. |
| **PII stripped before LLM** | Presidio redaction runs between Whisper output and Ollama prompt construction. The model never sees real identifiers. |
| **No persistent audio storage** | Uploaded audio files are held in memory for the duration of transcription then immediately deleted from disk. |
| **Local database** | `medi_scribe.db` is a local SQLite file. It is not transmitted anywhere and is excluded from version control. |
| **Vector index** | The ChromaDB index is a local directory. Embeddings are generated from already-redacted or non-patient PDF content. |
| **HIPAA-oriented design** | All processing is on-premise. The architecture follows minimum-necessary-data principles at every stage. |

---

## Project Structure

```
rag-medical-diagnoser/
│
├── docker-compose.yml          # Orchestrates both services
├── SETUP.md                    # Detailed setup and architecture reference
│
├── medi-backend/               # Python FastAPI service
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── api.py                  # FastAPI app — all endpoints
│   ├── database.py             # SQLAlchemy models + session factory
│   ├── rag_service.py          # ChromaDB + BM25 re-ranking logic
│   ├── prototype.py            # Standalone CLI pipeline (dev reference)
│   ├── app.py                  # Legacy Streamlit UI (dev reference)
│   └── make_audio.py           # Test audio generator (gTTS)
│
├── medi-frontend/              # Next.js / React service
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── next.config.ts          # standalone output enabled
│   ├── package.json
│   └── app/
│       ├── layout.tsx          # Root layout + metadata
│       ├── page.tsx            # Main dashboard (upload + polling + results)
│       ├── globals.css
│       ├── rag/
│       │   └── page.tsx        # RAG knowledge base Q&A interface
│       └── components/
│           ├── Sidebar.tsx         # Navigation (Next.js Link + usePathname)
│           ├── SessionHistory.tsx  # Live session list (right panel)
│           ├── FileUpload.tsx      # Drag-and-drop audio uploader
│           ├── ProgressStepper.tsx # Animated 3-step progress tracker
│           └── ResultsDashboard.tsx # SOAP / Redacted / Raw tab viewer
│
└── medi-rag/                   # Standalone RAG prototype (CLI, reference only)
    ├── rag.py
    └── sample-data.pdf
```

---

<div align="center">

Built with Python, TypeScript, and a commitment to patient data privacy.

**[View API Docs](http://localhost:8000/docs)** · **[Report an Issue](https://github.com/vap-dev07/rag-medical-diagnoser/issues)**

</div>
