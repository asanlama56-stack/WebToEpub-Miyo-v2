import { analyzeUrl, downloadChaptersParallel, fetchChapterContent } from "./scraper";
import { generateOutput } from "./generator";
import { storage } from "./storage";
import { defaultSettings } from "../shared/schema";
import fs from "fs";
import path from "path";

async function runCli() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node cli.js <url>");
    process.exit(1);
  }

  console.log(`Analyzing: ${url}...`);
  try {
    const { metadata, chapters } = await analyzeUrl(url);
    console.log(`Title: ${metadata.title}`);
    console.log(`Author: ${metadata.author}`);
    console.log(`Chapters found: ${chapters.length}`);

    const selectedChapters = chapters.slice(0, 2000);
    console.log(`Downloading ${selectedChapters.length} chapters...`);

    const jobId = "cli-job-" + Date.now();
    
    // Setup job in storage for progress tracking compatibility
    await storage.createJob(url);
    await storage.updateJob(jobId, { 
      metadata, 
      chapters: selectedChapters,
      status: "downloading"
    });

    await downloadChaptersParallel(
      selectedChapters,
      defaultSettings.concurrentDownloads,
      defaultSettings.delayBetweenRequests,
      metadata.detectedContentType,
      (id, status, content, wordCount, error, imageUrls) => {
        if (status === "complete") {
          const idx = selectedChapters.findIndex(c => c.id === id);
          selectedChapters[idx].content = content;
          selectedChapters[idx].imageUrls = imageUrls;
          process.stdout.write(".");
        } else if (status === "error") {
          process.stdout.write("x");
        }
      }
    );

    console.log("\nGenerating EPUB...");
    const result = await generateOutput(metadata, selectedChapters, "epub");
    
    const fileName = result.filename;
    fs.writeFileSync(fileName, result.buffer);
    console.log(`Success! Saved to: ${path.resolve(fileName)}`);
    process.exit(0);
  } catch (error) {
    console.error("CLI Error:", error);
    process.exit(1);
  }
}

runCli();
