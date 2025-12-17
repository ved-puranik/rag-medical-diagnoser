# Medical Diagnoser - Backend Implementation Documentation

## Overview

This document provides a comprehensive overview of the Medical Diagnoser backend application, detailing all implemented features, architecture, and technical specifications. The application is a prototype system that processes medical audio recordings through transcription, privacy-preserving anonymization, and AI-powered medical note generation.

## Application Architecture

The application follows a pipeline-based architecture with four distinct stages:

1. **Audio Generation** (`make_audio.py`)
2. **Audio Transcription** (Whisper)
3. **Privacy Protection** (Presidio)
4. **Medical Note Generation** (Ollama/LLM)

## Implemented Components

### 1. Audio Generation Module (`make_audio.py`)

**Purpose**: Generates test audio files for the medical transcription pipeline.

**Implementation Details**:
- Uses Google Text-to-Speech (gTTS) library to convert text to speech
- Creates MP3 audio files containing simulated patient conversations
- Includes sample patient data (name, phone number, medical complaint) for testing purposes

**Key Features**:
- Simple text-to-speech conversion
- MP3 file output format
- File existence verification after generation

**Usage**:
```bash
python make_audio.py
```

**Output**: Generates `test_audio.mp3` file in the current directory.

### 2. Main Processing Pipeline (`prototype.py`)

**Purpose**: Core application that processes audio files through the complete medical transcription and note generation workflow.

**Implementation Details**:

#### Stage 1: Setup and Initialization
- Validates audio file existence
- Loads OpenAI Whisper model (`base` variant, ~500MB, CPU-compatible)
- Initializes Presidio Analyzer and Anonymizer engines for PII detection and redaction
- Provides user feedback during initialization

#### Stage 2: Audio Transcription
- Uses Whisper AI model to transcribe audio files to text
- Supports MP3 audio format
- Extracts raw transcription text from audio input
- Displays raw transcription for verification

#### Stage 3: Privacy Protection (PII Redaction)
- Analyzes transcribed text for personally identifiable information (PII)
- Detects sensitive data including:
  - Names
  - Phone numbers
  - Addresses
  - Other personal identifiers
- Anonymizes detected PII using Presidio Anonymizer
- Produces sanitized text safe for further processing

#### Stage 4: Medical Note Generation
- Uses Ollama local LLM (Llama3 model) for medical note generation
- Implements expert medical scribe prompt engineering
- Generates structured SOAP notes (Subjective, Objective, Assessment, Plan)
- Ensures patient name anonymization in final output
- Formats output for medical documentation standards

**Key Features**:
- End-to-end audio processing pipeline
- Privacy-first design with automatic PII redaction
- Local AI processing (no external API dependencies for transcription/LLM)
- Structured medical documentation output
- Error handling and user feedback throughout the process

**Configuration**:
- `AUDIO_FILE`: Path to input audio file (default: "test_audio.mp3")
- `OLLAMA_MODEL`: LLM model name (default: "llama3")

**Usage**:
```bash
python prototype.py
```

**Prerequisites**:
- Ollama must be installed and running
- Llama3 model must be pulled: `ollama pull llama3`
- Audio file must exist (run `make_audio.py` first if needed)

### 3. Dependencies (`requirements.txt`)

**Package List**:
- `openai-whisper`: Audio transcription model
- `ollama`: Local LLM interface
- `presidio-analyzer`: PII detection engine
- `presidio-anonymizer`: PII redaction engine
- `spacy`: Natural language processing (dependency for Presidio)
- `gTTS`: Google Text-to-Speech for audio generation

## Technical Specifications

### Technology Stack

1. **Audio Processing**: OpenAI Whisper (base model)
   - Local execution
   - CPU-compatible
   - High accuracy transcription

2. **Privacy Protection**: Microsoft Presidio
   - AnalyzerEngine: Detects PII in text
   - AnonymizerEngine: Redacts detected PII
   - Language support: English (en)

3. **AI/LLM**: Ollama with Llama3
   - Local model execution
   - No external API calls
   - Privacy-preserving (data stays local)

4. **Audio Generation**: Google Text-to-Speech (gTTS)
   - Cloud-based TTS service
   - MP3 output format

### Data Flow

```
Audio File (MP3)
    ↓
[Whisper Transcription]
    ↓
Raw Text Transcript
    ↓
[Presidio Analysis]
    ↓
PII Detection Results
    ↓
[Presidio Anonymization]
    ↓
Sanitized Text
    ↓
[Ollama LLM Processing]
    ↓
SOAP Medical Note
```

### Privacy and Security Features

1. **Automatic PII Detection**: Identifies personal information in transcripts
2. **Data Anonymization**: Redacts sensitive information before LLM processing
3. **Local Processing**: Audio transcription and LLM inference run locally
4. **No External Storage**: All processing happens on-device (except gTTS for test audio generation)

### Error Handling

The application includes comprehensive error handling for:
- Missing audio files
- Whisper model loading failures
- Ollama connection issues
- File I/O operations

## Current Implementation Status

### ✅ Completed Features

1. Audio file generation for testing
2. Audio-to-text transcription using Whisper
3. PII detection and anonymization
4. Medical note generation using local LLM
5. Structured SOAP note output
6. Error handling and user feedback
7. Configuration management

### 🔄 Workflow

1. Generate test audio: `python make_audio.py`
2. Process audio: `python prototype.py`
3. Review output: Raw transcription → Redacted text → Medical note

## File Structure

```
medi-backend/
├── make_audio.py          # Audio generation utility
├── prototype.py           # Main processing pipeline
├── requirements.txt       # Python dependencies
├── test_audio.mp3        # Generated test audio file
└── IMPLEMENTATION.md     # This documentation file
```

## Installation and Setup

### Prerequisites

1. Python 3.x installed
2. Ollama installed and running
3. Llama3 model downloaded: `ollama pull llama3`

### Setup Steps

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Download spaCy language model (required by Presidio):
   ```bash
   python -m spacy download en_core_web_lg
   ```

3. Ensure Ollama is running and Llama3 is available

4. Generate test audio (optional):
   ```bash
   python make_audio.py
   ```

5. Run the main application:
   ```bash
   python prototype.py
   ```

## Design Decisions

1. **Local Processing**: Chose local models (Whisper, Ollama) to ensure patient data privacy and avoid external API dependencies
2. **Privacy-First**: Implemented PII redaction before LLM processing to protect patient information
3. **Modular Design**: Separated audio generation from processing pipeline for flexibility
4. **Error Resilience**: Added comprehensive error checking and user-friendly error messages
5. **Medical Standards**: Structured output as SOAP notes, following medical documentation best practices

## Future Considerations

While not currently implemented, potential enhancements could include:
- Real-time audio streaming support
- Multiple audio format support
- Custom medical note templates
- Integration with Electronic Health Records (EHR) systems
- Multi-language support
- Batch processing capabilities
- Web API interface
- Database storage for medical notes
- User authentication and authorization

## Notes

- The application is currently a prototype/demonstration system
- Test audio includes sample PII to demonstrate anonymization capabilities
- All AI processing runs locally for privacy and security
- The system is designed to be HIPAA-compliant through local processing and PII redaction

---

**Last Updated**: Current implementation
**Version**: Prototype v1.0
**Status**: Functional prototype with core features implemented

