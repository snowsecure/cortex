/**
 * PDF utilities: page count from File (client-side).
 * Uses pdfjs-dist; worker URL is set so Vite bundles it from node_modules.
 */
import * as pdfjsLib from "pdfjs-dist";

// Worker: ?url makes Vite resolve from node_modules and emit the worker; we get its URL
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Get the number of pages in a PDF File. Returns null if parsing fails.
 * @param {File} file - PDF file
 * @returns {Promise<number|null>}
 */
export async function getPdfPageCount(file) {
  if (!file || file.type !== "application/pdf") return null;
  try {
    const data = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    await pdf.destroy();
    return numPages;
  } catch (e) {
    console.warn("Could not get PDF page count:", e);
    return null;
  }
}
