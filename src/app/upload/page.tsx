"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
} from "lucide-react";
import Link from "next/link";

interface LogEntry {
  type: "status" | "chunked" | "progress" | "complete" | "error";
  message: string;
  progress?: number;
  totalChunks?: number;
  totalDocs?: number;
  upserted?: number;
  total?: number;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [indexName, setIndexName] = useState("");
  const [frameworkName, setFrameworkName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(150);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
    setTimeout(() => {
      logContainerRef.current?.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setLogs([]);
      setDone(false);
      setError(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith(".jsonl")) {
      setFile(dropped);
      setLogs([]);
      setDone(false);
      setError(false);
      setProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setLogs([]);
    setDone(false);
    setError(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file || !indexName.trim()) return;

    setUploading(true);
    setLogs([]);
    setDone(false);
    setError(false);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("indexName", indexName.trim());
    formData.append("frameworkName", frameworkName.trim());
    formData.append("namespace", namespace.trim());
    formData.append("chunkSize", String(chunkSize));
    formData.append("chunkOverlap", String(chunkOverlap));

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.body) {
        addLog({ type: "error", message: "No response stream" });
        setError(true);
        setUploading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as LogEntry;
              addLog(data);

              if (data.type === "progress" && data.progress !== undefined) {
                setProgress(data.progress);
              }
              if (data.type === "complete") {
                setProgress(100);
                setDone(true);
              }
              if (data.type === "error") {
                setError(true);
              }
            } catch {
              // skip malformed events
            }
          }
        }
      }
    } catch (err) {
      addLog({
        type: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
      setError(true);
    } finally {
      setUploading(false);
    }
  };

  const fileSizeLabel = file
    ? file.size < 1024
      ? `${file.size} B`
      : file.size < 1048576
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / 1048576).toFixed(1)} MB`
    : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload to Pinecone
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a JSONL file to chunk, embed, and store in a Pinecone index.
            Each line should be JSON with at least a <code>text</code> field.
          </p>
        </div>

        <div className="space-y-6">
          {/* File drop zone */}
          <Card
            className={`relative border-2 border-dashed p-8 text-center transition-colors ${
              file
                ? "border-primary/40 bg-primary/[0.03]"
                : "border-muted-foreground/20 hover:border-muted-foreground/40"
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fileSizeLabel}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-7 w-7"
                  onClick={clearFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  Drop a <code>.jsonl</code> file here or click to browse
                </p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl"
              onChange={handleFileSelect}
              className="hidden"
            />
          </Card>

          {/* Config */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="indexName">Index Name *</Label>
              <Input
                id="indexName"
                placeholder="e.g. my-transcripts"
                value={indexName}
                onChange={(e) => setIndexName(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="frameworkName">Framework Name</Label>
              <Input
                id="frameworkName"
                placeholder="e.g. my-framework"
                value={frameworkName}
                onChange={(e) => setFrameworkName(e.target.value)}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Groups all documents under one framework in the dashboard. If blank, each document shows separately.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="namespace">Namespace</Label>
              <Input
                id="namespace"
                placeholder="(default)"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chunkSize">Chunk Size (chars)</Label>
              <Input
                id="chunkSize"
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                disabled={uploading}
                min={100}
                max={5000}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="chunkOverlap">Chunk Overlap (chars)</Label>
              <Input
                id="chunkOverlap"
                type="number"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                disabled={uploading}
                min={0}
                max={chunkSize - 1}
              />
            </div>
          </div>

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={!file || !indexName.trim() || uploading}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Chunk & Upload
              </>
            )}
          </Button>

          {/* Progress + logs */}
          {logs.length > 0 && (
            <Card className="overflow-hidden">
              {(uploading || done) && (
                <div className="border-b px-4 py-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {done ? "Complete" : "Uploading…"}
                    </span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <div
                ref={logContainerRef}
                className="max-h-64 overflow-y-auto p-4 font-mono text-xs"
              >
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 py-0.5 ${
                      log.type === "error"
                        ? "text-red-400"
                        : log.type === "complete"
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {log.type === "error" ? (
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    ) : log.type === "complete" ? (
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                    ) : (
                      <span className="mt-0.5 h-3 w-3 shrink-0 text-center">
                        ›
                      </span>
                    )}
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
