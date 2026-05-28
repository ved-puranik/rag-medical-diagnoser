'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import FileUpload from './components/FileUpload';
import ProgressStepper from './components/ProgressStepper';
import ResultsDashboard from './components/ResultsDashboard';
import SessionHistory, { type SessionDetail } from './components/SessionHistory';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
const POLL_MS = 3500;

type ProcessingState = 'idle' | 'processing' | 'completed' | 'error';

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed';
}

const INITIAL_STEPS: ProcessingStep[] = [
  { id: 'transcribe', label: 'Transcribing Audio...', status: 'pending' },
  { id: 'redact',     label: 'Redacting PII...',      status: 'pending' },
  { id: 'generate',  label: 'Generating SOAP Note...', status: 'pending' },
];

const ALL_DONE_STEPS: ProcessingStep[] = [
  { id: 'transcribe', label: 'Transcribing Audio...', status: 'completed' },
  { id: 'redact',     label: 'Redacting PII...',      status: 'completed' },
  { id: 'generate',  label: 'Generating SOAP Note...', status: 'completed' },
];

export default function Dashboard() {
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [steps, setSteps] = useState<ProcessingStep[]>(INITIAL_STEPS);
  const [analysisResults, setAnalysisResults] = useState({
    soapNote: '',
    redactedTranscript: '',
    rawTranscript: '',
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Refs hold mutable timer handles so closures inside setInterval always see
  // the current values without needing to be in the dependency array.
  const pollingRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup on unmount — stops any running timers.
  useEffect(() => {
    return () => {
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timer helpers ────────────────────────────────────────────────────────────

  const clearAll = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    stepTimerRef.current.forEach(clearTimeout);
    stepTimerRef.current = [];
  };

  /**
   * Advance the three stepper labels over time to give visual feedback while
   * the backend pipeline runs.  The timings are estimates; the actual result
   * always wins — once polling detects completion we snap all steps to Done.
   */
  const startStepSimulation = () => {
    setSteps([
      { id: 'transcribe', label: 'Transcribing Audio...', status: 'processing' },
      { id: 'redact',     label: 'Redacting PII...',      status: 'pending'    },
      { id: 'generate',  label: 'Generating SOAP Note...', status: 'pending'   },
    ]);

    const t1 = setTimeout(() => {
      setSteps([
        { id: 'transcribe', label: 'Transcribing Audio...', status: 'completed' },
        { id: 'redact',     label: 'Redacting PII...',      status: 'processing' },
        { id: 'generate',  label: 'Generating SOAP Note...', status: 'pending'   },
      ]);
    }, 9_000);

    const t2 = setTimeout(() => {
      setSteps([
        { id: 'transcribe', label: 'Transcribing Audio...', status: 'completed' },
        { id: 'redact',     label: 'Redacting PII...',      status: 'completed'  },
        { id: 'generate',  label: 'Generating SOAP Note...', status: 'processing' },
      ]);
    }, 17_000);

    stepTimerRef.current = [t1, t2];
  };

  // ── Upload handler (async) ───────────────────────────────────────────────────

  const handleFileSelect = async (file: File) => {
    clearAll();
    setProcessingState('processing');
    setErrorMessage('');
    setActiveSessionId(null);
    startStepSimulation();

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Submit the file; get back a session_id immediately.
      const { data } = await axios.post<{ session_id: string; status: string }>(
        `${BACKEND}/analyze`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const { session_id: sessionId } = data;
      setActiveSessionId(sessionId);

      // Show the new "Running" row in history right away.
      setHistoryRefreshKey((k) => k + 1);

      // 2. Poll until the backend marks the session as completed.
      pollingRef.current = setInterval(async () => {
        try {
          const { data: session } = await axios.get<SessionDetail>(
            `${BACKEND}/sessions/${sessionId}`
          );

          if (session.status === 'completed') {
            clearAll();
            setAnalysisResults({
              soapNote:           session.soap_note,
              redactedTranscript: session.redacted_transcript,
              rawTranscript:      session.raw_transcript,
            });
            setSteps(ALL_DONE_STEPS);
            setProcessingState('completed');
            setHistoryRefreshKey((k) => k + 1);
          }
        } catch {
          clearAll();
          setErrorMessage(
            'Could not retrieve session results. The backend may have encountered an error.'
          );
          setProcessingState('error');
        }
      }, POLL_MS);

    } catch {
      clearAll();
      setErrorMessage(
        'Failed to submit audio. Is the Python server running on port 8000?'
      );
      setProcessingState('error');
    }
  };

  // ── History selection ────────────────────────────────────────────────────────

  const handleSessionSelect = (data: SessionDetail) => {
    clearAll();
    setActiveSessionId(data.id);
    setAnalysisResults({
      soapNote:           data.soap_note,
      redactedTranscript: data.redacted_transcript,
      rawTranscript:      data.raw_transcript,
    });
    setProcessingState('completed');
  };

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    clearAll();
    setProcessingState('idle');
    setActiveSessionId(null);
    setAnalysisResults({ soapNote: '', redactedTranscript: '', rawTranscript: '' });
    setSteps(INITIAL_STEPS);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Left nav */}
      <Sidebar />

      {/* Main content — min-w-0 prevents flex overflow */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">

          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">New Diagnosis</h1>
            <p className="mt-2 text-slate-600">
              Upload a patient audio recording to generate a secure, redacted SOAP note
            </p>
          </div>

          {/* ── Error banner ── */}
          {processingState === 'error' && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <span className="mt-0.5 text-base">🚨</span>
              <p className="flex-1 text-sm">{errorMessage}</p>
              <button
                onClick={handleReset}
                className="flex-shrink-0 text-sm font-semibold underline"
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── Upload zone (idle) ── */}
          {processingState === 'idle' && (
            <div className="mb-8">
              <FileUpload onFileSelect={handleFileSelect} />
            </div>
          )}

          {/* ── Async progress tracker (processing) ── */}
          {processingState === 'processing' && (
            <div className="mb-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
                <span className="animate-pulse">⚡</span> Processing Audio File…
              </h2>

              <div className="mb-6 rounded-lg bg-blue-50 px-4 py-3">
                <p className="text-sm text-blue-800">
                  The analysis is running in the background. Results will appear automatically
                  — no need to refresh or wait on this page.
                </p>
                {activeSessionId && (
                  <p className="mt-1 font-mono text-xs text-blue-500">
                    Session&nbsp;
                    <span className="font-semibold">
                      #{activeSessionId.slice(0, 8).toUpperCase()}
                    </span>
                  </p>
                )}
              </div>

              <ProgressStepper steps={steps} />
            </div>
          )}

          {/* ── Results view (completed) ── */}
          {processingState === 'completed' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Diagnosis Results
                  </h2>
                  {activeSessionId && (
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      Session&nbsp;
                      <span className="font-semibold text-slate-500">
                        #{activeSessionId.slice(0, 8).toUpperCase()}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
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

      {/* Right session history panel */}
      <SessionHistory
        refreshKey={historyRefreshKey}
        activeSessionId={activeSessionId}
        onSessionSelect={handleSessionSelect}
      />
    </div>
  );
}
