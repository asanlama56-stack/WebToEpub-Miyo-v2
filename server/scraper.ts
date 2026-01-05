import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import sanitizeHtml from "sanitize-html";
import { htmlToText } from "html-to-text";
import type { Chapter, BookMetadata, ContentTypeType, OutputFormatType } from "@shared/schema";
import { randomUUID } from "crypto";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  timeout = 30000
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Failed to fetch URL");
}

const chapterPatterns = [
  /chapter\s*[\d.]+/i,
  /ch\.\s*[\d.]+/i,
  /episode\s*[\d.]+/i,
  /part\s*[\d.]+/i,
  /volume\s*[\d.]+/i,
  /book\s*[\d.]+/i,
  /section\s*[\d.]+/i,
  /prologue/i,
  /epilogue/i,
  /introduction/i,
  /preface/i,
  /第\d+章/,
  /第\d+回/,
  /第\d+部/,
  /第\d+卷/,
  /第\d+编/,
  /章\s*\d+/i,
  /第\s*\d+\s*章/,
  /第\d+話/,
  /第\d+編/,
  /제\d+화/,
  /제\d+부/,
  /^\d+$/,
];

const chapterLinkSelectors = [
  'a[href*="chapter"]',
  'a[href*="ch"]',
  'a[href*="episode"]',
  'a[href*="part"]',
  ".chapter-list a",
  ".toc a",
  ".table-of-contents a",
  ".chapters a",
  ".chapter-item a",
  "#chapter-list a",
  ".story-parts a",
  ".volume-list a",
  '[class*="chapter"] a',
  '[id*="chapter"] a',
  "ul.chapters li a",
  ".entry-content a",
  "article a",
];

export function detectDescription($: cheerio.CheerioAPI): string | undefined {
  const clean = (str: string) => str.replace(/\s+/g, " ").trim();
  const isPlaceholder = (text: string) => {
    const lower = text.toLowerCase();
    return lower.includes("read") && lower.includes("novel online") && lower.includes("free");
  };
  const isTooShort = (t: string) => t.length < 60;

  const strongSelectors = [
    ".book-intro", ".book-desc", ".novel-summary", ".synopsis",
    ".story-intro", ".summary", "[data-synopsis]", "[data-summary]", "[data-book-info]"
  ];

  for (const sel of strongSelectors) {
    const el = $(sel).first();
    if (el.length > 0) {
      const text = clean(el.text());
      if (text && !isTooShort(text) && !isPlaceholder(text)) return text;
    }
  }

  const metaSelectors = ['meta[property="og:description"]', 'meta[name="description"]'];
  for (const sel of metaSelectors) {
    const content = clean($(sel).attr("content") || "");
    if (content && !isPlaceholder(content) && !isTooShort(content)) return content;
  }
  return undefined;
}

export function detectCoverImageUrl($: cheerio.CheerioAPI, pageUrl: string): string | undefined {
  const isPlaceholder = (url?: string) => {
    if (!url) return true;
    const u = url.toLowerCase();
    return u.includes("placeholder") || u.includes("default") || u.includes("noimage") || u.endsWith(".svg");
  };
  const makeAbs = (src: string) => {
    try { return new URL(src, pageUrl).href; } catch { return src; }
  };

  const strongSelectors = [
    ".book-img img", ".novel-cover img", ".book-cover img", ".detail-cover img",
    "img.cover", "img.book-cover", "img.novel-cover"
  ];

  for (const sel of strongSelectors) {
    const img = $(sel).first();
    if (img.length > 0) {
      let src = img.attr("src") || img.attr("data-src");
      if (src) {
        src = makeAbs(src);
        if (!isPlaceholder(src)) return src;
      }
    }
  }

  const og = $('meta[property="og:image"]').attr("content");
  if (og) {
    const abs = makeAbs(og);
    if (!isPlaceholder(abs)) return abs;
  }
  return undefined;
}

const contentSelectors = [
  ".chapter-content", ".entry-content", ".post-content", ".story-content",
  ".reading-content", ".text-content", ".novel-content", "#chapter-content",
  "#content", "article.post", "article", ".content", "main", ".prose"
];

const removeSelectors = [
  "script", "style", "noscript", "iframe", "nav", "footer", ".ads",
  ".advertisement", ".social-share", ".comments", ".sidebar", ".navigation"
];

function isChapterLink(text: string, href: string): boolean {
  const combinedText = `${text} ${href}`.toLowerCase();
  return chapterPatterns.some((pattern) => pattern.test(combinedText));
}

function extractNumber(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : Infinity;
}

export function detectContentType(html: string, url: string): ContentTypeType {
  const mangaDomains = ["fragrant-manga.com", "mangadex.org", "manganato.com", "mangakakalot.com"];
  if (mangaDomains.some(domain => url.includes(domain))) return "manga";
  
  const $ = cheerio.load(html);
  const mangaKeywords = ["manga", "manhua", "manhwa"];
  if (mangaKeywords.some(k => url.toLowerCase().includes(k)) && $("img").length > 20) return "manga";
  
  return "novel";
}

export function recommendFormat(contentType: ContentTypeType): OutputFormatType {
  return "epub";
}

async function downloadImage(url: string): Promise<{ data: Buffer; contentType: string } | undefined> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": getRandomUserAgent() } });
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();
    return { data: Buffer.from(buffer), contentType: response.headers.get("content-type") || "" };
  } catch { return undefined; }
}

export async function analyzeUrl(url: string): Promise<{ metadata: BookMetadata; chapters: Chapter[] }> {
  let html = await fetchWithRetry(url);
  let $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || $('meta[property="og:title"]').attr("content") || "Untitled";
  const author = $('meta[name="author"]').attr("content") || "Unknown Author";
  const description = detectDescription($) || "";
  const coverUrl = detectCoverImageUrl($, url);

  const chapters: Chapter[] = [];
  const seenUrls = new Set<string>();
  
  $("a").each((_, element) => {
    const href = $(element).attr("href");
    const text = $(element).text().trim();
    if (href && text && isChapterLink(text, href)) {
      try {
        const fullUrl = new URL(href, url).href;
        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          chapters.push({ 
            id: randomUUID(), 
            title: text, 
            url: fullUrl, 
            index: chapters.length, 
            status: "pending" 
          });
        }
      } catch {}
    }
  });

  // Sort chapters by title number if possible
  chapters.sort((a, b) => {
    const numA = extractNumber(a.title);
    const numB = extractNumber(b.title);
    if (numA !== Infinity && numB !== Infinity) return numA - numB;
    return a.index - b.index;
  });

  const contentType = detectContentType(html, url);
  return {
    metadata: {
      title, author, description, coverUrl, sourceUrl: url,
      detectedContentType: contentType, recommendedFormat: recommendFormat(contentType),
      totalChapters: chapters.length, language: $("html").attr("lang") || "en"
    },
    chapters
  };
}

export async function fetchChapterContent(
  chapterUrl: string,
  cleanup = true,
  contentType: ContentTypeType = "novel"
): Promise<{ content: string; wordCount: number; imageUrls?: string[] }> {
  const html = await fetchWithRetry(chapterUrl);
  const $ = cheerio.load(html);

  if (contentType === "manga") {
    const imageUrls: string[] = [];
    $("img").each((_, img) => {
      let src = $(img).attr("data-src") || $(img).attr("src") || $(img).attr("data-original");
      if (src) {
        try {
          // Clean up common lazy loading patterns
          src = src.trim();
          if (src.startsWith("//")) src = "https:" + src;
          const absUrl = new URL(src, chapterUrl).toString();
          if (!absUrl.includes("logo") && !absUrl.includes("icon") && !absUrl.includes("avatar")) {
            imageUrls.push(absUrl);
          }
        } catch (e) {}
      }
    });
    return { content: "", wordCount: 0, imageUrls };
  }

  removeSelectors.forEach(s => $(s).remove());
  let content = "";
  for (const s of contentSelectors) {
    const $c = $(s);
    if ($c.length > 0) {
      content = $c.first().html() || "";
      if (content.length > 500) break;
    }
  }

  const textContent = htmlToText(content || $.html(), { wordwrap: false });
  return { content: content || $.html(), wordCount: textContent.split(/\s+/).length };
}

export async function downloadChaptersParallel(
  chapters: Chapter[],
  concurrency: number,
  delayMs: number,
  contentType: ContentTypeType,
  onProgress: (id: string, status: "downloading" | "complete" | "error", content?: string, wordCount?: number, error?: string, imageUrls?: string[]) => void
): Promise<void> {
  const queue = [...chapters];
  const workers = Array(concurrency).fill(null).map(async () => {
    while (queue.length > 0) {
      const chapter = queue.shift()!;
      onProgress(chapter.id, "downloading");
      try {
        const { content, wordCount, imageUrls } = await fetchChapterContent(chapter.url, true, contentType);
        onProgress(chapter.id, "complete", content, wordCount, undefined, imageUrls);
      } catch (e) {
        onProgress(chapter.id, "error", undefined, undefined, String(e));
      }
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
  });
  await Promise.all(workers);
}
