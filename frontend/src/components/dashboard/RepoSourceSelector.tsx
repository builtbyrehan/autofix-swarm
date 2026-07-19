"use client";

import { useRef, useState, useCallback } from "react";
import {
  Code,
  FileCode,
  FileUp,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Terminal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, HudPanel, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DURATION, ease, EASE } from "@/lib/easing";

export type CodeSource = "demo" | "custom";

export interface CustomCodeState {
  /** Paste tab: map of filename → content */
  pastedFiles: Record<string, string>;
  /** Upload tab: list of uploaded file names */
  uploadedFiles: string[];
  /** Raw upload form data (for the upload endpoint) */
  uploadFormData: FormData | null;
  /** Combined file count */
  fileCount: number;
  /** Combined total bytes */
  totalBytes: number;
}

const MAX_FILES = 50;
const MAX_BYTES = 512 * 1024; // 512 KiB
const ALLOWED_EXTS = [".py", ".txt", ".cfg", ".ini", ".toml", ".yaml", ".yml", ".json", ".md"];

interface RepoSourceSelectorProps {
  source: CodeSource;
  onSourceChange: (source: CodeSource) => void;
  customCode: CustomCodeState;
  onCustomCodeChange: (state: CustomCodeState) => void;
}

export function RepoSourceSelector({
  source,
  onSourceChange,
  customCode,
  onCustomCodeChange,
}: RepoSourceSelectorProps) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [pasteFileName, setPasteFileName] = useState("main.py");
  const [pasteContent, setPasteContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (files: Record<string, string>): string | null => {
      const count = Object.keys(files).length;
      if (count === 0) return "No files added yet.";
      if (count > MAX_FILES)
        return `Too many files: ${count} exceeds limit of ${MAX_FILES}.`;

      let bytes = 0;
      for (const [name, content] of Object.entries(files)) {
        const ext = name.split(".").pop()?.toLowerCase();
        if (ext && !ALLOWED_EXTS.some((e) => e.endsWith(ext)) && !ALLOWED_EXTS.includes(`.${ext}`)) {
          return `Unsupported file type: "${name}". Only .py and config files are allowed.`;
        }
        bytes += new TextEncoder().encode(content).length;
      }
      if (bytes > MAX_BYTES)
        return `Total size (${(bytes / 1024).toFixed(1)} KiB) exceeds limit of ${(MAX_BYTES / 1024).toFixed(0)} KiB.`;

      return null;
    },
    []
  );

  // Paste tab: add pasted file
  const handleAddPastedFile = useCallback(() => {
    const name = pasteFileName.trim();
    const content = pasteContent.trim();
    if (!name || !content) return;

    const err = validateFiles({ ...customCode.pastedFiles, [name]: content });
    if (err) {
      setError(err);
      return;
    }

    setError(null);
    const updated = { ...customCode.pastedFiles, [name]: content };
    const bytes = Object.entries(updated).reduce(
      (sum, [, c]) => sum + new TextEncoder().encode(c).length,
      0
    );
    onCustomCodeChange({
      ...customCode,
      pastedFiles: updated,
      fileCount: Object.keys(updated).length,
      totalBytes: bytes,
    });
    setPasteFileName("main.py");
    setPasteContent("");
  }, [pasteFileName, pasteContent, customCode, validateFiles, onCustomCodeChange]);

  // Paste tab: remove a pasted file
  const handleRemovePastedFile = useCallback(
    (name: string) => {
      const updated = { ...customCode.pastedFiles };
      delete updated[name];
      const bytes = Object.entries(updated).reduce(
        (sum, [, c]) => sum + new TextEncoder().encode(c).length,
        0
      );
      onCustomCodeChange({
        ...customCode,
        pastedFiles: updated,
        fileCount: Object.keys(updated).length,
        totalBytes: bytes,
      });
      setError(null);
    },
    [customCode, onCustomCodeChange]
  );

  // Upload tab: handle file-picker / drop
  const handleFiles = useCallback(
    (fileList: FileList) => {
      setError(null);
      const newNames: string[] = [];
      const newFormData = new FormData();

      for (const file of Array.from(fileList)) {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
          setError(`Unsupported file: "${file.name}". Only .py and config files are allowed.`);
          return;
        }
        newNames.push(file.name);
        newFormData.append("files", file, file.name);
      }

      const allNames = [...customCode.uploadedFiles, ...newNames];
      if (allNames.length > MAX_FILES) {
        setError(`Too many files: ${allNames.length} exceeds limit of ${MAX_FILES}.`);
        return;
      }

      const totalSize =
        customCode.totalBytes +
        Array.from(fileList).reduce((s, f) => s + f.size, 0);
      if (totalSize > MAX_BYTES) {
        setError(`Total size exceeds limit of ${(MAX_BYTES / 1024).toFixed(0)} KiB.`);
        return;
      }

      // Merge form data: keep existing entries, add new ones
      const merged = customCode.uploadFormData || new FormData();
      if (customCode.uploadFormData) {
        for (const file of Array.from(fileList)) {
          merged.append("files", file, file.name);
        }
      }

      onCustomCodeChange({
        ...customCode,
        uploadedFiles: allNames,
        uploadFormData: merged,
        fileCount: allNames.length,
        totalBytes: totalSize,
      });
    },
    [customCode, onCustomCodeChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleRemoveUploaded = useCallback(
    (name: string) => {
      // Rebuild form data without the removed file
      const updatedNames = customCode.uploadedFiles.filter((n) => n !== name);
      const updatedFD = new FormData();
      if (customCode.uploadFormData) {
        for (const [key, val] of customCode.uploadFormData.entries()) {
          if (val instanceof File && val.name !== name) {
            updatedFD.append(key, val, val.name);
          }
        }
      }
      // Approximate byte count
      const approxBytes = updatedNames.length * 2048;
      onCustomCodeChange({
        ...customCode,
        uploadedFiles: updatedNames,
        uploadFormData: updatedFD,
        fileCount: updatedNames.length,
        totalBytes: approxBytes,
      });
      setError(null);
    },
    [customCode, onCustomCodeChange]
  );

  const totalSizeKiB = (customCode.totalBytes / 1024).toFixed(1);
  const limitKiB = (MAX_BYTES / 1024).toFixed(0);

  const clearCustom = useCallback(() => {
    onCustomCodeChange({
      pastedFiles: {},
      uploadedFiles: [],
      uploadFormData: null,
      fileCount: 0,
      totalBytes: 0,
    });
    setError(null);
    setPasteContent("");
    setPasteFileName("main.py");
  }, [onCustomCodeChange]);

  return (
    <div className="space-y-3">
      {/* Toggle: Demo vs Custom */}
      <div className="flex items-center gap-3">
        <p className="telemetry-label shrink-0 text-[10px]">Code Source</p>
        <div className="flex rounded-lg border border-border bg-bg-0/60 p-0.5">
          <button
            onClick={() => {
              onSourceChange("demo");
              clearCustom();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              source === "demo"
                ? "bg-watcher/15 text-watcher shadow-elev0"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Terminal className="h-3.5 w-3.5" />
            Demo Repo
          </button>
          <button
            onClick={() => onSourceChange("custom")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              source === "custom"
                ? "bg-watcher/15 text-watcher shadow-elev0"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code className="h-3.5 w-3.5" />
            Your Code
          </button>
        </div>

        {source === "custom" && customCode.fileCount > 0 && (
          <Badge variant="teal" className="text-[9px]">
            {customCode.fileCount} file{customCode.fileCount !== 1 ? "s" : ""} ·{" "}
            {totalSizeKiB} KiB
          </Badge>
        )}
      </div>

      {/* Custom code panel */}
      <AnimatePresence>
        {source === "custom" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.fast, ease: ease(EASE.primary) }}
            className="overflow-hidden"
          >
            <HudPanel elev={0} className="p-4">
              {/* Tabs */}
              <div className="mb-3 flex items-center gap-4 border-b border-border pb-2">
                <button
                  onClick={() => setTab("paste")}
                  className={cn(
                    "flex items-center gap-1.5 pb-1 text-xs font-medium transition-colors",
                    tab === "paste"
                      ? "border-b-2 border-watcher text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileCode className="h-3.5 w-3.5" />
                  Paste code
                </button>
                <button
                  onClick={() => setTab("upload")}
                  className={cn(
                    "flex items-center gap-1.5 pb-1 text-xs font-medium transition-colors",
                    tab === "upload"
                      ? "border-b-2 border-watcher text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Upload files
                </button>

                {customCode.fileCount > 0 && (
                  <button
                    onClick={clearCustom}
                    className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-error transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              {/* Paste tab */}
              {tab === "paste" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pasteFileName}
                      onChange={(e) => setPasteFileName(e.target.value)}
                      placeholder="filename.py"
                      className="flex-1 rounded border border-border bg-bg-0 px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-watcher/50"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Max {limitKiB} KiB total
                    </span>
                  </div>
                  <textarea
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder="Paste your code here..."
                    rows={6}
                    className="w-full rounded border border-border bg-bg-0 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 outline-none resize-y focus:border-watcher/50"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {pasteContent.length} chars
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddPastedFile}
                      disabled={!pasteFileName.trim() || !pasteContent.trim()}
                    >
                      <Code className="h-3 w-3" />
                      Add File
                    </Button>
                  </div>

                  {/* Pasted files list */}
                  {Object.keys(customCode.pastedFiles).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">
                        Pasted files:
                      </p>
                      {Object.entries(customCode.pastedFiles).map(
                        ([name, content]) => (
                          <div
                            key={name}
                            className="flex items-center justify-between rounded bg-bg-0/60 px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <FileCode className="h-3 w-3 text-codex" />
                              <span className="font-mono text-xs text-foreground">
                                {name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {content.length} chars
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemovePastedFile(name)}
                              className="text-muted-foreground hover:text-error transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Upload tab */}
              {tab === "upload" && (
                <div className="space-y-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors",
                      dragOver
                        ? "border-watcher bg-watcher/5"
                        : "border-border bg-bg-0/30 hover:border-watcher/40"
                    )}
                  >
                    <Upload
                      className={cn(
                        "h-8 w-8",
                        dragOver ? "text-watcher" : "text-muted-foreground"
                      )}
                    />
                    <p className="text-sm text-muted-foreground">
                      Drop .py files or a .zip here, or click to browse
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Max {MAX_FILES} files · {limitKiB} KiB total
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".py,.zip,.txt,.cfg,.ini,.toml,.yaml,.yml,.json,.md"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFiles(e.target.files);
                        }
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* Uploaded files list */}
                  {customCode.uploadedFiles.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">
                        Uploaded files:
                      </p>
                      {customCode.uploadedFiles.map((name) => (
                        <div
                          key={name}
                          className="flex items-center justify-between rounded bg-bg-0/60 px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-3 w-3 text-codex" />
                            <span className="font-mono text-xs text-foreground">
                              {name}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveUploaded(name)}
                            className="text-muted-foreground hover:text-error transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Validation error */}
              {error && (
                <div className="mt-3 flex items-start gap-2 rounded bg-error/10 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
                  <p className="text-xs text-error">{error}</p>
                </div>
              )}

              {/* Ready indicator */}
              {!error && customCode.fileCount > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded bg-success/10 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <p className="text-xs text-success">
                    {customCode.fileCount} file
                    {customCode.fileCount !== 1 ? "s" : ""} ready ·{" "}
                    {totalSizeKiB} KiB
                    {customCode.fileCount >=
                    (Object.keys(customCode.pastedFiles).length > 0
                      ? 0
                      : 0)
                      ? ""
                      : ""}
                    {customCode.uploadedFiles.length > 0 &&
                    Object.keys(customCode.pastedFiles).length > 0
                      ? " (mixed paste + upload)"
                      : customCode.uploadedFiles.length > 0
                        ? " (upload)"
                        : " (paste)"}
                  </p>
                </div>
              )}

              {!error && customCode.fileCount === 0 && (
                <div className="mt-3 flex items-center gap-2 rounded bg-muted/20 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Add code to run the pipeline against your own project.
                  </p>
                </div>
              )}
            </HudPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
