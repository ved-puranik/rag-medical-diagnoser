'use client';

import { useState } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import FileUpload from './components/FileUpload';
import ProgressStepper from './components/ProgressStepper';
import ResultsDashboard from './components/ResultsDashboard';

type ProcessingState = 'idle' | 'processing' | 'completed' | 'error';

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed';
}

export default function Dashboard() {
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Store the REAL data from Python here
  const [analysisResults, setAnalysisResults] = useState({
    soapNote: '',
    redactedTranscript: '',
    rawTranscript: ''
  });

  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'transcribe', label: 'Transcribing Audio...', status: 'pending' },
    { id: 'redact', label: 'Redacting PII...', status: 'pending' },
    { id: 'generate', label: 'Generating SOAP Note...', status: 'pending' },
  ]);

  const handleFileSelect = async (file: File) => {
    // 1. Reset UI State
    setProcessingState('processing');
    setErrorMessage('');
    setSteps([
      { id: 'transcribe', label: 'Transcribing Audio...', status: 'processing' },
      { id: 'redact', label: 'Redacting PII...', status: 'pending' },
      { id: 'generate', label: 'Generating SOAP Note...', status: 'pending' },
    ]);

    // 2. Prepare the File for Upload
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 3. Send to Python Backend (Port 8000)
      // Note: This request will take 10-30 seconds to complete
      const response = await axios.post('http://127.0.0.1:8000/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 4. Update UI with Real Data
      setAnalysisResults({
        soapNote: response.data.soap_note,
        redactedTranscript: response.data.redacted_text,
        rawTranscript: response.data.raw_transcription
      });

      // Mark all steps as complete
      setSteps([
        { id: 'transcribe', label: 'Transcribing Audio...', status: 'completed' },
        { id: 'redact', label: 'Redacting PII...', status: 'completed' },
        { id: 'generate', label: 'Generating SOAP Note...', status: 'completed' },
      ]);
      
      setProcessingState('completed');

    } catch (error: any) {
      console.error("Backend Error:", error);
      setErrorMessage("Failed to connect to the backend. Is your Python server running on Port 8000?");
      setProcessingState('error');
    }
  };

  const handleReset = () => {
    setProcessingState('idle');
    setAnalysisResults({ soapNote: '', redactedTranscript: '', rawTranscript: '' });
    setSteps([
      { id: 'transcribe', label: 'Transcribing Audio...', status: 'pending' },
      { id: 'redact', label: 'Redacting PII...', status: 'pending' },
      { id: 'generate', label: 'Generating SOAP Note...', status: 'pending' },
    ]);
  };

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">New Diagnosis</h1>
            <p className="mt-2 text-slate-600">
              Upload an audio file to generate a professional SOAP note
            </p>
          </div>

          {/* Error Message */}
          {processingState === 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              🚨 {errorMessage}
              <button onClick={handleReset} className="ml-4 underline font-bold">Try Again</button>
            </div>
          )}

          {/* Upload Section */}
          {processingState === 'idle' && (
            <div className="mb-8">
              <FileUpload onFileSelect={handleFileSelect} />
            </div>
          )}

          {/* Processing Section */}
          {processingState === 'processing' && (
            <div className="mb-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-semibold text-slate-900 flex items-center gap-2">
                <span className="animate-pulse">⚡</span> Processing Audio File...
              </h2>
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 text-sm">
                Please wait. Large files may take 30-60 seconds to process locally.
              </div>
              <ProgressStepper steps={steps} />
            </div>
          )}

          {/* Results Section */}
          {processingState === 'completed' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-slate-900">Diagnosis Results</h2>
                <button
                  onClick={handleReset}
                  className="rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Process New File
                </button>
              </div>
              
              <ResultsDashboard
                soapNote={analysisResults.soapNote}
                redactedTranscript={analysisResults.redactedTranscript}
                rawTranscript={analysisResults.rawTranscript}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}