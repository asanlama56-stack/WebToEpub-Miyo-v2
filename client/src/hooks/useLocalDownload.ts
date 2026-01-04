import { useState, useCallback } from "react";

type State = "idle"|"fetching"|"saving"|"done"|"error";

export function useLocalDownload() {
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = useCallback(async (id: string, filename?: string) => {
    setState("fetching"); setProgress(0); setError(null);
    try {
      const resp = await fetch(`/api/download-file/${encodeURIComponent(id)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const contentLength = resp.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength,10) : undefined;
      const reader = resp.body?.getReader();
      if (!reader) {
        const blob = await resp.blob();
        saveBlob(blob, filename || inferFilename(resp) || "file");
        setState("done"); setProgress(100); return;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total) setProgress(Math.round((received/total)*100));
          else setProgress(prev => Math.min(prev + 2, 95));
        }
      }
      const blob = new Blob(chunks, { type: resp.headers.get("Content-Type") || undefined });
      setState("saving");
      saveBlob(blob, filename || inferFilename(resp) || "file");
      setProgress(100);
      setState("done");
    } catch (err:any) {
      console.error("download err", err);
      setError(err?.message || String(err));
      setState("error");
    }
  }, []);

  return { state, progress, error, downloadFile };
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

function inferFilename(resp: Response) {
  const cd = resp.headers.get("Content-Disposition");
  if (cd) {
    const match = /filename\*?=(?:UTF-8'')?["']?([^;"']+)/i.exec(cd);
    if (match) return decodeURIComponent(match[1]);
  }
  try {
    const url = new URL(resp.url);
    return url.pathname.split("/").pop() || undefined;
  } catch { return undefined; }
}
