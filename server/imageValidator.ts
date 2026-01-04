import axios from "axios";
import { fileTypeFromBuffer } from "file-type";
import { updateImageJob, getImageJob } from "./jobs/imageJobs";

export async function validateImageJob(jobId: string) {
  const job = getImageJob(jobId);
  if (!job || !job.detectedUrl) return;

  updateImageJob(jobId, { state: "loading" });
  job.logs.push("[START] Validating cover image: " + job.detectedUrl);

  try {
    const response = await axios.get(job.detectedUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true
    });

    job.logs.push(`[HTTP] Status: ${response.status}`);

    if (response.status !== 200) {
      throw new Error("HTTP " + response.status);
    }

    const buffer = Buffer.from(response.data);
    job.bytesDownloaded = buffer.length;
    job.logs.push(`[BYTES] ${buffer.length} bytes downloaded`);

    if (buffer.length < 2000) {
      throw new Error("Image is too small (< 2KB)");
    }

    const ft = await fileTypeFromBuffer(buffer);
    const mime = ft?.mime || "image/jpeg";
    job.logs.push(`[MIME] ${mime}`);
    job.mimeType = mime;

    if (!mime.startsWith("image/")) {
      throw new Error(`Not an image: ${mime}`);
    }

    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    job.dataUrlLength = dataUrl.length;

    updateImageJob(jobId, {
      finalUrl: dataUrl,
      state: "success"
    });

    job.logs.push("[SUCCESS] Image validated and converted");
  } catch (err: any) {
    job.logs.push("[ERROR] " + err.message);
    updateImageJob(jobId, {
      error: err.message,
      state: "failed"
    });
  }
}
