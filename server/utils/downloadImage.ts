import axios from "axios";
import { fileTypeFromBuffer } from "file-type";
import { dlog } from "./logger";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function downloadImageBuffer(url: string, maxAttempts = 4) {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      dlog("download:start", `GET ${url}`, { attempt });
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 20000,
        maxRedirects: 6,
        validateStatus: (s) => s >= 200 && s < 400,
        headers: { "User-Agent": "WebToBook/1.0 (+https://your.app)" }
      });

      const buffer = Buffer.from(res.data);
      const bytes = buffer.length;
      const headerLength = res.headers["content-length"] ? parseInt(res.headers["content-length"], 10) : null;
      dlog("download:got", "HTTP response", { status: res.status, headerLength, bytes });

      if (headerLength && Math.abs(headerLength - bytes) > 1024) {
        dlog("download:warning", "Content-Length mismatch", { headerLength, bytes });
      }

      const ft = await fileTypeFromBuffer(buffer);
      const mime = ft?.mime || res.headers["content-type"] || "application/octet-stream";
      dlog("download:filetype", "Detected", { mime, ext: ft?.ext });

      if (!mime.startsWith("image/")) throw new Error("Downloaded content is not an image: " + mime);

      return { buffer, mime, bytes, ext: ft?.ext };
    } catch (err: any) {
      lastErr = err;
      dlog("download:error", "Attempt failed", { attempt, err: String(err) });
      const backoff = 200 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }
  dlog("download:failed", "All attempts failed", { lastErr: String(lastErr) });
  throw lastErr;
}
