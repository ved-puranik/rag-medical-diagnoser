'use client';

import { useState, useRef } from 'react';
import { Upload, FileAudio, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function FileUpload({ onFileSelect, disabled = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(
      (file) => file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|m4a)$/i)
    );

    if (audioFile) {
      setSelectedFile(audioFile);
      onFileSelect(audioFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a"
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />

      {selectedFile ? (
        <div className="rounded-lg border-2 border-teal-200 bg-teal-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100">
                <FileAudio className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{selectedFile.name}</p>
                <p className="text-sm text-slate-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              disabled={disabled}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200
            ${
              isDragging
                ? 'border-teal-400 bg-teal-50 scale-[1.02]'
                : disabled
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/50'
            }
          `}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className={`
                flex h-16 w-16 items-center justify-center rounded-full transition-colors
                ${
                  isDragging
                    ? 'bg-teal-100'
                    : disabled
                    ? 'bg-slate-100'
                    : 'bg-slate-100 group-hover:bg-teal-100'
                }
              `}
            >
              <Upload
                className={`
                  h-8 w-8 transition-colors
                  ${isDragging ? 'text-teal-600' : disabled ? 'text-slate-400' : 'text-slate-500'}
                `}
              />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {isDragging ? 'Drop audio file here' : 'Upload Audio File'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Drag and drop MP3, WAV, or M4A files, or click to browse
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Supports patient-doctor conversations and voice memos
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

