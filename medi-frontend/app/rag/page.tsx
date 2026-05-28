'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Upload,
} from 'lucide-react';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface RAGStatus {
  is_ready: boolean;
  has_vectorstore: boolean;
  has_qa_chain: boolean;
  db_exists: boolean;
}

interface SourceRef {
  source_file: string;
  page: number | string;
}

interface QueryHistoryItem {
  question: string;
  answer: string;
  sources: SourceRef[];
  timestamp: Date;
}

export default function RAGPage() {
  const [status, setStatus] = useState<RAGStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message?: string;
    pages?: number;
    chunks?: number;
  } | null>(null);
  const [question, setQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { data } = await axios.get<RAGStatus>(`${BACKEND}/rag/status`);
      setStatus(data);
    } catch {
      // backend not yet reachable — leave status null
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data } = await axios.post(`${BACKEND}/rag/upload-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadResult({
        success: true,
        message: data.message,
        pages: data.pages,
        chunks: data.chunks,
      });

      await checkStatus();
      setSelectedFile(null);
    } catch (error: unknown) {
      const detail =
        axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
      setUploadResult({
        success: false,
        message: detail ?? 'Failed to upload PDF',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async () => {
    if (!question.trim() || !status?.is_ready || isQuerying) return;

    const currentQuestion = question;
    setIsQuerying(true);
    setQuestion('');

    try {
      const { data } = await axios.post<{
        success: boolean;
        answer: string;
        question: string;
        sources: SourceRef[];
      }>(`${BACKEND}/rag/query`, { question: currentQuestion });

      setQueryHistory((prev) => [
        {
          question: currentQuestion,
          answer: data.answer,
          sources: data.sources ?? [],
          timestamp: new Date(),
        },
        ...prev,
      ]);
    } catch (error: unknown) {
      const detail =
        axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
      setQueryHistory((prev) => [
        {
          question: currentQuestion,
          answer: `Error: ${detail ?? 'Failed to get answer'}`,
          sources: [],
          timestamp: new Date(),
        },
        ...prev,
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">

          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">RAG Knowledge Base</h1>
            <p className="mt-2 text-slate-600">
              Upload medical documents and ask questions using AI-powered retrieval
            </p>
          </div>

          {/* Status card */}
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {status?.is_ready ? (
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-slate-400" />
                )}
                <div>
                  <p className="font-medium text-slate-900">
                    {status?.is_ready ? 'Knowledge Base Ready' : 'No Knowledge Base Loaded'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {status?.is_ready
                      ? 'You can now ask questions about your documents'
                      : 'Upload a PDF to get started'}
                  </p>
                </div>
              </div>
              <button
                onClick={checkStatus}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
              >
                Refresh Status
              </button>
            </div>
          </div>

          {/* PDF upload */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Upload Document</h2>

            <div className="mb-4">
              <input
                type="file"
                accept=".pdf"
                id="pdf-upload"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
              <label
                htmlFor="pdf-upload"
                className={[
                  'flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
                  isUploading
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50'
                    : selectedFile
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/50',
                ].join(' ')}
              >
                <Upload className="h-6 w-6 text-slate-500" />
                <div className="text-center">
                  <p className="font-medium text-slate-900">
                    {selectedFile ? selectedFile.name : 'Click to upload PDF'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedFile
                      ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                      : 'Medical documents, guidelines, research papers'}
                  </p>
                </div>
              </label>
            </div>

            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing PDF…
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    Process Document
                  </>
                )}
              </button>
            )}

            {uploadResult && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-lg border p-4 ${
                  uploadResult.success
                    ? 'border-teal-200 bg-teal-50 text-teal-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {uploadResult.success ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium">{uploadResult.message}</p>
                  {uploadResult.success && (
                    <p className="mt-1 text-sm">
                      Processed {uploadResult.pages} pages into {uploadResult.chunks} chunks
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Query input */}
          {status?.is_ready && (
            <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Ask a Question</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                  placeholder="Ask anything about your document…"
                  disabled={isQuerying}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
                <button
                  onClick={handleQuery}
                  disabled={!question.trim() || isQuerying}
                  className="flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-3 font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isQuerying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Thinking…
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Ask
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Query history */}
          {queryHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-slate-900">
                <MessageSquare className="h-5 w-5" />
                Conversation History
              </h2>

              <div className="space-y-6">
                {queryHistory.map((item, index) => (
                  <div
                    key={index}
                    className="border-b border-slate-100 pb-6 last:border-0 last:pb-0"
                  >
                    {/* Question */}
                    <p className="font-medium text-slate-900">Q: {item.question}</p>

                    {/* Answer */}
                    <p className="mt-2 leading-relaxed text-slate-700">{item.answer}</p>

                    {/* Source chips */}
                    {item.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.sources.map((src, i) => (
                          <span
                            key={i}
                            className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                            title={`${src.source_file} — Page ${src.page}`}
                          >
                            <FileText className="h-3 w-3 text-slate-400" />
                            {src.source_file}&nbsp;(Page&nbsp;{src.page})
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="mt-2 text-xs text-slate-400">
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!status?.is_ready && queryHistory.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-lg font-medium text-slate-600">No knowledge base loaded</p>
              <p className="mt-2 text-sm text-slate-500">
                Upload a PDF document above to start asking questions
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
