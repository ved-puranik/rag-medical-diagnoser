import streamlit as st
import whisper
import ollama
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
import os

# --- PAGE SETUP ---
st.set_page_config(page_title="Medi-Diagnoser", page_icon="🩺", layout="wide")

st.title("🩺 AI Medical Scribe & Diagnoser")
st.markdown("Upload a patient audio file to generate a **secure, redacted SOAP note** automatically.")

# --- SIDEBAR ---
with st.sidebar:
    st.header("⚙️ Settings")
    model_name = st.selectbox("Select LLM Model", ["llama3", "llama3.2", "mistral"], index=0)
    st.info("Ensure Ollama is running in the background!")

# --- MAIN LOGIC ---
uploaded_file = st.file_uploader("📂 Upload Patient Recording (MP3/WAV)", type=["mp3", "wav"])

if uploaded_file is not None:
    # 1. Save the uploaded file temporarily so Whisper can read it
    with open("temp_audio.mp3", "wb") as f:
        f.write(uploaded_file.getbuffer())
    
    # Display Audio Player
    st.audio("temp_audio.mp3", format="audio/mp3")

    if st.button("🚀 Analyze Recording"):
        # --- STAGE 1: TRANSCRIBE ---
        with st.status("🎧 Transcribing audio...", expanded=True) as status:
            try:
                model = whisper.load_model("base")
                result = model.transcribe("temp_audio.mp3")
                raw_text = result["text"]
                status.write("✅ Transcription Complete")
            except Exception as e:
                st.error(f"Error extracting audio: {e}")
                st.stop()

            # --- STAGE 2: REDACT ---
            status.write("🕵️ Scrubbing personal data (PII)...")
            analyzer = AnalyzerEngine()
            anonymizer = AnonymizerEngine()

            analysis_results = analyzer.analyze(text=raw_text, language='en')
            redacted_result = anonymizer.anonymize(
                text=raw_text,
                analyzer_results=analysis_results
            )
            safe_text = redacted_result.text
            status.write("✅ Redaction Complete")

            # --- STAGE 3: SUMMARIZE ---
            status.write(f"🧠 Consulting {model_name} for medical assessment...")
            
            prompt = f"""
            You are an expert medical scribe. 
            Read the following transcript and write a concise SOAP note (Subjective, Objective, Assessment, Plan).
            Do NOT use the patient's real name; refer to them as 'Patient'.
            
            Transcript: "{safe_text}"
            """
            
            try:
                response = ollama.chat(model=model_name, messages=[
                    {'role': 'user', 'content': prompt},
                ])
                soap_note = response['message']['content']
                status.update(label="✅ Diagnosis Complete!", state="complete", expanded=False)
            except Exception as e:
                st.error(f"Ollama Error: {e}")
                st.stop()

        # --- RESULTS DISPLAY ---
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("📝 Original Transcript (Private)")
            st.text_area("Raw Text", raw_text, height=300)

        with col2:
            st.subheader("🔒 Redacted Transcript (Safe)")
            st.text_area("Scrubbed Text", safe_text, height=300)

        st.divider()
        st.subheader("📋 Final Medical SOAP Note")
        st.markdown(soap_note)