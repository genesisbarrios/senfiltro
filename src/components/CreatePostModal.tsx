"use client";

import React, { useEffect, useRef, useState } from "react";

type UploadType = "image" | "video" | "audio" | null;

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (payload: { text: string; mediaFile?: File | null }) => Promise<void> | void;
}

export default function CreatePostModal({ open, onClose, onCreate }: CreatePostModalProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<UploadType>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (uploadOpen) {
          setUploadOpen(false);
          setUploadType(null);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, uploadOpen]);

  useEffect(() => {
    if (open) {
      setText("");
      setSubmitting(false);
      setMediaFile(null);
      setPreviewUrl(null);
      setUploadOpen(false);
      setUploadType(null);
    }
  }, [open]);

  useEffect(() => {
    if (!mediaFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(mediaFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [mediaFile]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setSubmitting(true);
    try {
      await onCreate?.({ text, mediaFile: mediaFile ?? undefined });
      setTimeout(() => {
        setSubmitting(false);
        onClose();
      }, 300);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  }

  function openUploadPanel(type: UploadType) {
    setUploadType(type);
    setUploadOpen(true);
    // open native picker after panel opens
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (uploadType === "image" && !f.type.startsWith("image/")) return;
    if (uploadType === "video" && !f.type.startsWith("video/")) return;
    if (uploadType === "audio" && !f.type.startsWith("audio/")) return;
    setMediaFile(f);
    setUploadOpen(false);
    setUploadType(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = dt.files;
    onFilesSelected(files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function clearMedia() {
    setMediaFile(null);
    setPreviewUrl(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl bg-gray-900 border border-gray-700 rounded shadow-lg"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="text-white font-medium">Create Post</div>
          <button
            onClick={onClose}
            className="text-white opacity-80 hover:opacity-100 px-2 py-1 rounded"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            className="w-full h-36 p-3 bg-gray-800 text-white rounded border border-gray-700 resize-none"
            required
          />

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openUploadPanel("image")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                aria-label="Attach image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14l4-3 3 2 4-4 5 3z" />
                </svg>
                <span className="text-sm">Image</span>
              </button>

              <button
                type="button"
                onClick={() => openUploadPanel("video")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                aria-label="Attach video"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4V6.5l-4 4z" />
                </svg>
                <span className="text-sm">Video</span>
              </button>

              <button
                type="button"
                onClick={() => openUploadPanel("audio")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                aria-label="Attach audio"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
                </svg>
                <span className="text-sm">Audio</span>
              </button>
            </div>

            {mediaFile && (
              <div className="p-2 bg-gray-800 rounded border border-gray-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm text-gray-200 mb-1">{mediaFile.name}</div>

                    {mediaFile.type.startsWith("image/") && previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="preview" className="max-h-40 rounded" />
                    )}

                    {mediaFile.type.startsWith("video/") && previewUrl && (
                      <video src={previewUrl} controls className="max-h-40 rounded w-full" />
                    )}

                    {mediaFile.type.startsWith("audio/") && previewUrl && (
                      <audio src={previewUrl} controls className="w-full" />
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={clearMedia}
                      className="px-2 py-1 bg-gray-700 rounded text-sm text-red-400 hover:bg-gray-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={
              uploadType === "image"
                ? "image/*"
                : uploadType === "video"
                ? "video/*"
                : uploadType === "audio"
                ? "audio/*"
                : undefined
            }
            onChange={(e) => onFilesSelected(e.target.files)}
          />

          {uploadOpen && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setDragOver(false)}
              className={`mt-2 p-4 border-2 rounded border-dashed ${dragOver ? "border-blue-400 bg-gray-800/60" : "border-gray-700 bg-gray-900"}`}
            >
              <div className="text-center text-white">
                <div className="mb-2 font-medium">{uploadType ? `Upload ${uploadType}` : "Upload file"}</div>
                <div className="text-sm text-gray-400 mb-3">Drag & drop here, or click to browse</div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#1976D2] text-white rounded hover:bg-[#00BCD4]"
                  >
                    Browse files
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUploadOpen(false); setUploadType(null); }}
                    className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Accepted: {uploadType === "image" ? "images" : uploadType === "video" ? "videos" : uploadType === "audio" ? "audio files" : "files"}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#1976D2] text-white rounded hover:bg-[#00BCD4] transition disabled:opacity-60"
              >
                {submitting ? "Posting..." : "Post"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
            <div className="text-sm text-gray-400">{text.length}/280</div>
          </div>
        </form>
      </div>
    </div>
  );
}