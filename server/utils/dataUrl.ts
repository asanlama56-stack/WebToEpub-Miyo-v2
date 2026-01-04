import { dlog } from "./logger";

export function makeSafeDataUrl(buffer: Buffer, mime: string, sizeLimitBytes = 1.5 * 1024 * 1024) {
  const bytes = buffer.length;
  dlog("dataurl:start", "create", { mime, bytes, sizeLimitBytes });
  if (bytes === 0) { dlog("dataurl:error","empty"); return null; }
  if (bytes > sizeLimitBytes) { dlog("dataurl:skip","too large", { bytes }); return null; }
  const base64 = buffer.toString("base64");
  if (base64.length % 4 !== 0) { dlog("dataurl:bad","base64 length invalid"); return null; }
  const dataUrl = `data:${mime};base64,${base64}`;
  dlog("dataurl:ok","created", { finalLength: dataUrl.length });
  return dataUrl;
}
