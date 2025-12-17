import whisper
import ollama
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
import os

# --- CONFIGURATION ---
AUDIO_FILE = "test_audio.mp3"
OLLAMA_MODEL = "llama3"  # Ensure you have run: ollama pull llama3

def main():
    # 1. SETUP: Check files and tools
    if not os.path.exists(AUDIO_FILE):
        print(f"❌ Error: {AUDIO_FILE} not found. Please run 'python make_audio.py' first.")
        return

    print("⏳ Loading local Whisper model... (This downloads ~500MB the first time)")
    # 'base' is a small, fast model. It runs on your CPU.
    try:
        audio_model = whisper.load_model("base")
    except Exception as e:
        print(f"❌ Error loading Whisper: {e}")
        return

    analyzer = AnalyzerEngine()
    anonymizer = AnonymizerEngine()

    print("✅ All tools loaded successfully.\n")

    # 2. TRANSCRIBE (Audio -> Text)
    print(f"🎤 Transcribing {AUDIO_FILE}...")
    result = audio_model.transcribe(AUDIO_FILE)
    raw_text = result["text"]
    print(f"\n📝 RAW TRANSCRIPTION:\n{raw_text}\n")

    # 3. REDACT (Text -> Safe Text)
    print("🕵️  Scrubbing personal information...")
    analysis_results = analyzer.analyze(text=raw_text, language='en')
    redacted_result = anonymizer.anonymize(
        text=raw_text,
        analyzer_results=analysis_results
    )
    safe_text = redacted_result.text
    print(f"🔒 REDACTED TEXT:\n{safe_text}\n")

    # 4. SUMMARIZE (Safe Text -> Medical Note)
    print(f"🧠 Generating medical note using {OLLAMA_MODEL}...")
    prompt = f"""
    You are an expert medical scribe. 
    Read the following transcript and write a concise SOAP note (Subjective, Objective, Assessment, Plan).
    Do NOT use the patient's real name; refer to them as 'Patient'.

    Transcript: "{safe_text}"
    """

    try:
        response = ollama.chat(model=OLLAMA_MODEL, messages=[
            {'role': 'user', 'content': prompt},
        ])

        summary = response['message']['content']
        print("\n" + "="*40)
        print("📋 FINAL MEDICAL NOTE")
        print("="*40)
        print(summary)
        print("="*40)
    except Exception as e:
        print(f"❌ Ollama Error: {e}")
        print("👉 Tip: Is the Ollama app running in the background?")

if __name__ == "__main__":
    main()