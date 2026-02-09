import React, { useState, useCallback, useRef } from "react";
import { Download, FileText, Upload, Loader2, Palette, AlertTriangle, X, Eye, Square } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getMergedExtractionData } from "../lib/utils";
import { agentFillDocument, fileToBase64 } from "../lib/retab";
import { RETAB_MODELS } from "../lib/retabConfig";
import { schemas } from "../schemas/index";

function useElapsedTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  React.useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
      return () => clearInterval(id);
    }
    setElapsed(0);
    startRef.current = null;
  }, [running]);
  return elapsed;
}

function formatElapsed(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function FillFormsPage({ packets }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const exportablePackets = React.useMemo(
    () => (packets || []).filter((p) => p.status === PacketStatus.COMPLETED || p.status === PacketStatus.NEEDS_REVIEW),
    [packets]
  );

  const [formFile, setFormFile] = useState(null);
  const [formBase64, setFormBase64] = useState(null);
  const [selectedPacketId, setSelectedPacketId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("retab-small");
  const [color, setColor] = useState("#000080");
  const [filling, setFilling] = useState(false);
  const [filledPdfUrl, setFilledPdfUrl] = useState(null);
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState(null);

  const elapsed = useElapsedTimer(filling);

  const buildInstructions = useCallback(
    (packetId) => {
      const pkt = exportablePackets.find((p) => p.id === packetId);
      if (!pkt) return "";
      const lines = [];
      for (const doc of pkt.documents || []) {
        const { data } = getMergedExtractionData(doc, schemas);
        if (!data) continue;
        for (const [key, value] of Object.entries(data)) {
          if (value != null && value !== "" && !key.startsWith("reasoning___") && !key.startsWith("source___")) {
            lines.push(`${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${value}`);
          }
        }
      }
      return [...new Set(lines)].join("\n");
    },
    [exportablePackets]
  );

  const handleFileSelect = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFormFile(file);
      setFilledPdfUrl(null);
      setFormData(null);
      setError(null);
      try {
        setFormBase64(await fileToBase64(file));
      } catch {
        toast.error("Failed to read file");
      }
    },
    [toast]
  );

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!file.type.includes("pdf")) {
        toast.error("Only PDF files are supported");
        return;
      }
      setFormFile(file);
      setFilledPdfUrl(null);
      setFormData(null);
      setError(null);
      try {
        setFormBase64(await fileToBase64(file));
      } catch {
        toast.error("Failed to read file");
      }
    },
    [toast]
  );

  const handlePacketChange = useCallback(
    (e) => {
      const id = e.target.value;
      setSelectedPacketId(id);
      if (id) setInstructions(buildInstructions(id));
    },
    [buildInstructions]
  );

  const handleFill = useCallback(async () => {
    if (!formBase64 || !instructions.trim()) {
      toast.error("Upload a form and provide instructions");
      return;
    }
    setFilling(true);
    setError(null);
    setFilledPdfUrl(null);
    setFormData(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await agentFillDocument({
        document: formBase64,
        filename: formFile?.name || "form.pdf",
        instructions: instructions.trim(),
        model,
        color,
      });
      if (controller.signal.aborted) return;
      if (result.filled_document?.url) setFilledPdfUrl(result.filled_document.url);
      if (result.form_data) setFormData(result.form_data);
      toast.success("Form filled successfully");
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Fill failed:", err);
      setError(err.message);
      toast.error("Fill failed: " + err.message);
    } finally {
      setFilling(false);
      abortRef.current = null;
    }
  }, [formBase64, formFile, instructions, model, color, toast]);

  const handleCancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setFilling(false);
    toast.info?.("Fill cancelled") ?? toast.success("Fill cancelled");
  }, [toast]);

  const handleDownload = useCallback(() => {
    if (!filledPdfUrl) return;
    const base64Content = filledPdfUrl.split(",")[1];
    if (!base64Content) return;
    const byteCharacters = atob(base64Content);
    const bytes = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) bytes[i] = byteCharacters.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filled-${formFile?.name || "form.pdf"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filledPdfUrl, formFile]);

  const handleReset = useCallback(() => {
    setFormFile(null);
    setFormBase64(null);
    setFilledPdfUrl(null);
    setFormData(null);
    setError(null);
    setInstructions("");
    setSelectedPacketId("");
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-6 pt-4 pb-0 shrink-0">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Fill Forms</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Upload a blank PDF form and fill it with extracted data using AI
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto">
          {exportablePackets.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No processed documents yet</p>
              <p className="text-sm mt-1">Process documents from the Upload tab first. Then you can use their data to fill PDF forms here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {!formFile ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-xl p-8 text-center cursor-pointer hover:border-[#9e2339]/40 hover:bg-[#9e2339]/5 transition-all"
                  >
                    <Upload className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Drop a blank PDF form here</p>
                    <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                    <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-neutral-600 rounded-lg p-3 flex items-center justify-between bg-gray-50 dark:bg-neutral-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-[#9e2339] shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{formFile.name}</span>
                      <span className="text-xs text-gray-400">({(formFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button onClick={handleReset} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded">
                      <X className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  </div>
                )}

                {formFile && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Data source</label>
                      <select
                        value={selectedPacketId}
                        onChange={handlePacketChange}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200"
                      >
                        <option value="">Select a processed packet...</option>
                        {exportablePackets.map((pkt) => (
                          <option key={pkt.id} value={pkt.id}>
                            {pkt.filename || pkt.name} ({pkt.documents?.length || 0} docs)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                        Fill instructions
                        {selectedPacketId && <span className="text-gray-400 font-normal"> (auto-generated from packet)</span>}
                      </label>
                      <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder={"Enter field values, e.g.:\nBuyer Name: John Smith\nProperty Address: 123 Main St"}
                        rows={8}
                        className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200 resize-y"
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Model</label>
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200"
                        >
                          {Object.entries(RETAB_MODELS)
                            .filter(([id]) => !id.startsWith("auto"))
                            .map(([id, m]) => (
                              <option key={id} value={id}>
                                {m.name} — ${m.costPerPage.toFixed(3)}/pg
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <Palette className="h-3 w-3" /> Color
                        </label>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-12 h-[38px] rounded-lg border border-gray-200 dark:border-neutral-600 cursor-pointer"
                        />
                      </div>
                    </div>
                    {filling ? (
                      <div className="space-y-2">
                        <Button onClick={handleCancel} className="w-full bg-gray-600 hover:bg-gray-700 text-white">
                          <Square className="h-4 w-4 mr-2" /> Cancel ({formatElapsed(elapsed)})
                        </Button>
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                          AI is analyzing the form and filling fields. This typically takes 30–90 seconds.
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={handleFill}
                        disabled={!instructions.trim()}
                        className="w-full bg-[#9e2339] hover:bg-[#9e2339]/90 text-white"
                      >
                        <Upload className="h-4 w-4 mr-2" /> Fill document
                      </Button>
                    )}
                    {error && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                {filledPdfUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Filled document</h4>
                      <Button size="sm" onClick={handleDownload} className="bg-[#9e2339] hover:bg-[#9e2339]/90 text-white">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
                      </Button>
                    </div>
                    <div
                      className="border border-gray-200 dark:border-neutral-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-900"
                      style={{ height: "500px" }}
                    >
                      <iframe src={filledPdfUrl} title="Filled document preview" className="w-full h-full" />
                    </div>
                    {formData?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
                          Detected fields ({formData.length})
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {formData.map((field, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-neutral-800"
                            >
                              <span className="text-gray-500 dark:text-gray-400 font-mono">{field.key}</span>
                              <span className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[60%] text-right">
                                {field.value || "\u2014"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl flex items-center justify-center text-center"
                    style={{ height: "400px" }}
                  >
                    <div>
                      {filling ? (
                        <>
                          <Loader2 className="h-8 w-8 mx-auto mb-3 text-[#9e2339] animate-spin" />
                          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Filling form...</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatElapsed(elapsed)} elapsed</p>
                        </>
                      ) : (
                        <>
                          <Eye className="h-8 w-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                          <p className="text-sm text-gray-400 dark:text-gray-500">Filled document preview</p>
                          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Upload a form and fill it to see results here</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FillFormsPage;
