'use client';

import { useState } from 'react';
import { FileText, Eye, EyeOff, Copy, Check } from 'lucide-react';

interface ResultsDashboardProps {
  soapNote: string;
  redactedTranscript: string;
  rawTranscript: string;
}

export default function ResultsDashboard({
  soapNote,
  redactedTranscript,
  rawTranscript,
}: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'soap' | 'redacted' | 'raw'>('soap');
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: 'soap' as const, label: 'SOAP Note', icon: FileText },
    { id: 'redacted' as const, label: 'Redacted Transcript', icon: Eye },
    { id: 'raw' as const, label: 'Raw Transcript', icon: EyeOff },
  ];

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCurrentContent = () => {
    switch (activeTab) {
      case 'soap':
        return soapNote;
      case 'redacted':
        return redactedTranscript;
      case 'raw':
        return rawTranscript;
    }
  };

  const highlightRedactedText = (text: string) => {
    // Highlight <PERSON>, <PHONE_NUMBER>, etc. tags
    return text.split(/(<[^>]+>)/g).map((part, index) => {
      if (part.match(/^<[^>]+>$/)) {
        return (
          <span
            key={index}
            className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-mono text-sm"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'raw') {
                  setShowRawTranscript(true);
                }
              }}
              className={`
                flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="relative rounded-lg border border-slate-200 bg-white">
        {/* Copy Button */}
        <div className="absolute right-4 top-4 z-10">
          <button
            onClick={() => handleCopy(getCurrentContent())}
            className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-teal-600" />
                <span className="text-teal-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'soap' && (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                {soapNote}
              </pre>
            </div>
          )}

          {activeTab === 'redacted' && (
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                {highlightRedactedText(redactedTranscript)}
              </p>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="relative">
              {!showRawTranscript ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <EyeOff className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-lg font-medium text-slate-500 mb-2">
                    Raw Transcript Hidden
                  </p>
                  <p className="text-sm text-slate-400 mb-4">
                    For privacy, the raw transcript is hidden by default
                  </p>
                  <button
                    onClick={() => setShowRawTranscript(true)}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Show Raw Transcript
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/80 to-white pointer-events-none" />
                  <pre className="whitespace-pre-wrap font-mono text-sm text-slate-600 leading-relaxed blur-sm select-none">
                    {rawTranscript}
                  </pre>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-lg bg-white/95 border border-slate-200 p-4 shadow-lg">
                      <p className="text-sm font-medium text-slate-700 mb-2">
                        Raw transcript contains sensitive PII
                      </p>
                      <p className="text-xs text-slate-500">
                        This view is intentionally blurred for privacy protection
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

