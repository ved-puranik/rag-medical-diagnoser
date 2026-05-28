'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Clock, History, Loader2, RefreshCw } from 'lucide-react';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

// Exported so page.tsx can type-check the onSessionSelect callback.
export interface SessionDetail {
  id: string;
  created_at: string | null;
  raw_transcript: string;
  redacted_transcript: string;
  soap_note: string;
  status: 'processing' | 'completed';
}

interface SessionSummary {
  id: string;
  created_at: string | null;
  status: 'processing' | 'completed';
}

interface Props {
  refreshKey: number;
  activeSessionId: string | null;
  onSessionSelect: (data: SessionDetail) => void;
}

function shortId(id: string): string {
  return '#' + id.slice(0, 8).toUpperCase();
}

function formatTs(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SessionHistory({ refreshKey, activeSessionId, onSessionSelect }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setIsFetching(true);
    try {
      const { data } = await axios.get<SessionSummary[]>(`${BACKEND}/sessions`);
      setSessions(data);
    } catch {
      // Backend may not be running yet — fail silently.
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [refreshKey]);

  const handleClick = async (sessionId: string) => {
    if (loadingId) return;
    setLoadingId(sessionId);
    try {
      const { data } = await axios.get<SessionDetail>(`${BACKEND}/sessions/${sessionId}`);
      onSessionSelect(data);
    } catch {
      // ignore individual fetch errors
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <aside className="flex h-screen w-72 flex-none flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-slate-200 px-4">
        <History className="h-4 w-4 text-teal-600" />
        <span className="text-sm font-semibold text-slate-800">Session History</span>
        {sessions.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {sessions.length}
          </span>
        )}
        {isFetching && (
          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-slate-400" />
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {!isFetching && sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <History className="mb-3 h-8 w-8 text-slate-200" />
            <p className="text-xs font-medium text-slate-400">No sessions yet</p>
            <p className="mt-1 text-xs text-slate-300">Upload an audio file to begin</p>
          </div>
        ) : (
          <ul className="py-1">
            {sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              const isItemLoading = loadingId === s.id;
              const isRunning = s.status === 'processing';

              return (
                <li key={s.id}>
                  <button
                    onClick={() => !isRunning && handleClick(s.id)}
                    disabled={isRunning || !!loadingId}
                    className={[
                      'group w-full border-l-2 px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'border-teal-500 bg-teal-50'
                        : isRunning
                        ? 'cursor-default border-transparent opacity-60'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                      loadingId && !isItemLoading ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Status icon */}
                      <div className="flex-shrink-0">
                        {isItemLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                        ) : isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                        ) : (
                          <CheckCircle2
                            className={`h-4 w-4 transition-colors ${
                              isActive
                                ? 'text-teal-600'
                                : 'text-teal-400 group-hover:text-teal-500'
                            }`}
                          />
                        )}
                      </div>

                      {/* Short ID + timestamp */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-mono text-xs font-semibold ${
                            isActive ? 'text-teal-700' : 'text-slate-700'
                          }`}
                        >
                          {shortId(s.id)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{formatTs(s.created_at)}</span>
                        </p>
                      </div>

                      {/* Status badge */}
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          isRunning
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        {isRunning ? 'Running' : 'Done'}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Manual refresh */}
      <div className="flex-shrink-0 border-t border-slate-200 p-3">
        <button
          onClick={fetchSessions}
          disabled={isFetching}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-50 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </aside>
  );
}
