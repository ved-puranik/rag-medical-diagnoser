'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Upload, FileText, Send, Loader2, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';

interface RAGStatus {
  is_ready: boolean;
  has_vectorstore: boolean;
  has_qa_chain: boolean;
  db_exists: boolean;
}

export default function RAGPage() {
  const [status, setStatus] = useState<RAGStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message?: string; pages?: number; chunks?: number } | null>(null);
  const [question, setQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryHistory, setQueryHistory] = useState<Array<{ question: string; answer: string; timestamp: Date }>>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Check RAG status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/rag/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Error checking status:', error);
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

      const response = await axios.post('http://127.0.0.1:8000/rag/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadResult({
        success: true,
        message: response.data.message,
        pages: response.data.pages,
        chunks: response.data.chunks,
      });

      // Refresh status
      await checkStatus();
      setSelectedFile(null);
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to upload PDF',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async () => {
    if (!question.trim() || !status?.is_ready) return;

    setIsQuerying(true);
    const currentQuestion = question;

    try {
      const response = await axios.post('http://127.0.0.1:8000/rag/query', {
        question: currentQuestion,
      });

      setQueryHistory((prev) => [
        {
          question: currentQuestion,
          answer: response.data.answer,
          timestamp: new Date(),
        },
        ...prev,
      ]);

      setQuestion('');
    } catch (error: any) {
      setQueryHistory((prev) => [
        {
          question: currentQuestion,
          answer: `Error: ${error.response?.data?.detail || 'Failed to get answer'}`,
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
      
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">RAG Knowledge Base</h1>
            <p className="mt-2 text-slate-600">
              Upload medical documents and ask questions using AI-powered retrieval
            </p>
          </div>

          {/* Status Card */}
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
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Refresh Status
              </button>
            </div>
          </div>

          {/* PDF Upload Section */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Upload Document</h2>
            
            <div className="mb-4">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
                id="pdf-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="pdf-upload"
                className={`
                  flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors
                  ${
                    isUploading
                      ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                      : selectedFile
                      ? 'border-teal-300 bg-teal-50'
                      : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/50'
                  }
                `}
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing PDF...
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
                className={`mt-4 rounded-lg p-4 ${
                  uploadResult.success
                    ? 'bg-teal-50 border border-teal-200 text-teal-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 mt-0.5" />
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
              </div>
            )}
          </div>

          {/* Query Section */}
          {status?.is_ready && (
            <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Ask a Question</h2>
              
              <div className="flex gap-3">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isQuerying && handleQuery()}
                  placeholder="Ask a question about your document..."
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  disabled={isQuerying}
                />
                <button
                  onClick={handleQuery}
                  disabled={!question.trim() || isQuerying}
                  className="flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-3 font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isQuerying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Thinking...
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

          {/* Query History */}
          {queryHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-900">
                <MessageSquare className="h-5 w-5" />
                Conversation History
              </h2>
              
              <div className="space-y-6">
                {queryHistory.map((item, index) => (
                  <div key={index} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                    <div className="mb-2">
                      <p className="font-medium text-slate-900">Q: {item.question}</p>
                      <p className="mt-2 text-slate-700 leading-relaxed">{item.answer}</p>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!status?.is_ready && queryHistory.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-lg font-medium text-slate-600">
                No knowledge base loaded
              </p>
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

