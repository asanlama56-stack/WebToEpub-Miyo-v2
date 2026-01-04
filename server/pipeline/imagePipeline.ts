import NodeCache from "node-cache";
import { createImageJob, updateImageJob, getImageJob } from "../jobs/imageJobs";
import { downloadImageBuffer } from "../utils/downloadImage";
import { makeSafeDataUrl } from "../utils/dataUrl";
import { dlog } from "../utils/logger";

const imageCache = new NodeCache({ stdTTL: 60*60, checkperiod: 120 });

export async function startImageJob(detectedUrl?: string) {
  const job = createImageJob(detectedUrl);
  if (!detectedUrl) {
    updateImageJob(job.id, { state: "failed", error: "No detected URL" });
    return job;
  }

  (async () => {
    try {
      updateImageJob(job.id, { state: "loading", logs: [...(job.logs||[]), "loading"] });
      dlog("job:start", "job started", { jobId: job.id, detectedUrl });

      const dl = await downloadImageBuffer(detectedUrl);
      updateImageJob(job.id, {
        downloadAttempts: 1,
        bytesDownloaded: dl.bytes,
        mimeType: dl.mime
      });

      const dataUrl = makeSafeDataUrl(dl.buffer, dl.mime);
      if (dataUrl) {
        updateImageJob(job.id, { finalUrl: dataUrl, dataUrlLength: dataUrl.length, state: "success" });
        dlog("job:success", "data url created", { jobId: job.id });
        return;
      }

      const proxyId = `img_${job.id}`;
      imageCache.set(proxyId, { buffer: dl.buffer, mime: dl.mime });
      updateImageJob(job.id, { proxyId, finalUrl: `/api/image/${proxyId}`, state: "success" });
      dlog("job:proxy", "stored proxy", { jobId: job.id, proxyId });
    } catch (err:any) {
      dlog("job:error", "job failed", { jobId: job.id, err: String(err) });
      updateImageJob(job.id, { state: "failed", error: err?.message || String(err) });
    }
  })();

  return job;
}

export function getCachedImage(proxyId:string) {
  return imageCache.get<{ buffer:Buffer, mime:string }>(proxyId);
}

export function getImageCache() {
  return imageCache;
}
