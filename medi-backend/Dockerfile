# ─────────────────────────────────────────────────────────────────────────────
# Medi-Diagnoser — Backend
# python:3.11-slim keeps the base small while remaining stable.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# --- System dependencies ------------------------------------------------------
# ffmpeg   → Whisper needs it to decode audio formats (mp3, wav, m4a …)
# curl     → used by the Docker Compose healthcheck
# git      → some pip packages resolve git URLs at install time
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Python dependencies ------------------------------------------------------
# Copy requirements first so this layer is cached unless requirements change.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- spaCy language model -----------------------------------------------------
# Presidio's NER engine requires en_core_web_lg.
RUN python -m spacy download en_core_web_lg

# --- Whisper model pre-download -----------------------------------------------
# The 'base' model is ~150 MB and is baked into the image so the container
# starts without an internet fetch on every cold boot.
RUN python -c "import whisper; whisper.load_model('base')"

# --- Application source -------------------------------------------------------
COPY *.py .

# --- Persistent data directory ------------------------------------------------
# ./data/ holds medi_scribe.db (SQLite) and rag_vector_db/ (ChromaDB).
# A bind-mount from the host is expected here in docker-compose so data
# survives container restarts and rebuilds.
RUN mkdir -p /app/data

EXPOSE 8000

# Bind to 0.0.0.0 so Docker's port mapping works; workers=1 avoids
# Whisper being loaded multiple times.
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
