import archiver from "archiver";
import { Writable, Readable } from "stream";
import PDFDocument from "pdfkit";
import { htmlToText } from "html-to-text";
import type { Chapter, BookMetadata, OutputFormatType } from "@shared/schema";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createMimetype(): string {
  return "application/epub+zip";
}

function createContainer(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function createContentOpf(
  metadata: BookMetadata,
  chapters: { id: string; title: string }[],
  hasCover: boolean = false
): string {
  const uuid = generateUUID();
  const now = new Date().toISOString();

  const coverManifestItem = hasCover ? `    <item id="cover" href="cover.jpg" media-type="image/jpeg"/>\n` : "";

  const manifestItems = chapters
    .map((ch, idx) => `    <item id="chapter${idx}" href="chapter${idx}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n");

  const spineItems = chapters
    .map((_, idx) => `    <itemref idref="chapter${idx}"/>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author)}</dc:creator>
    <dc:language>${metadata.language || "en"}</dc:language>
    <dc:description>${escapeXml(metadata.description || "")}</dc:description>
    <dc:source>${escapeXml(metadata.sourceUrl)}</dc:source>
    ${hasCover ? `<meta name="cover" content="cover"/>` : ""}
    <meta property="dcterms:modified">${now.slice(0, 19)}Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
${coverManifestItem}${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`;
}

function createNavXhtml(chapters: { id: string; title: string }[]): string {
  const navItems = chapters
    .map(
      (ch, idx) =>
        `        <li><a href="chapter${idx}.xhtml">${escapeXml(ch.title)}</a></li>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;
}

function createStyleCss(): string {
  return `body {
  font-family: Georgia, "Times New Roman", serif;
  margin: 1em;
  line-height: 1.6;
  color: #333;
}

.manga-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.manga-page {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6 {
  font-family: Arial, Helvetica, sans-serif;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

h1 { font-size: 2em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.2em; }

p {
  margin: 0.5em 0;
  text-indent: 1.5em;
}

p:first-of-type {
  text-indent: 0;
}

blockquote {
  margin: 1em 2em;
  font-style: italic;
  border-left: 3px solid #ccc;
  padding-left: 1em;
}

pre, code {
  font-family: "Courier New", monospace;
  font-size: 0.9em;
  background: #f4f4f4;
  padding: 0.2em 0.4em;
}

pre {
  padding: 1em;
  overflow-x: auto;
  white-space: pre-wrap;
}

a {
  color: #0066cc;
  text-decoration: none;
}

img {
  max-width: 100%;
  height: auto;
}

hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 2em 0;
}

nav ol {
  list-style-type: decimal;
  padding-left: 1.5em;
}

nav li {
  margin: 0.3em 0;
}
`;
}

function createChapterXhtml(title: string, content: string, imageUrls?: string[]): string {
  let cleanContent = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  cleanContent = cleanContent
    .replace(/<br\s*\/?>/gi, "<br/>")
    .replace(/<hr\s*\/?>/gi, "<hr/>")
    .replace(/<img([^>]*)>/gi, "<img$1/>");

  const imagesHtml = imageUrls && imageUrls.length > 0
    ? `<div class="manga-strip">
        ${imageUrls.map(url => `<img src="${url}" alt="Manga Page" class="manga-page"/>`).join("\n")}
      </div>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
  <div class="chapter-content">
    ${imagesHtml}
    ${cleanContent}
  </div>
</body>
</html>`;
}

export async function generateEpub(
  metadata: BookMetadata,
  chapters: Chapter[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    const archive = archiver("zip", {
      zlib: { level: 6 },
    });

    archive.on("warning", (err: any) => {
      if (err.code === "ENOENT") {
        console.warn("[EPUB] Archive warning:", err.message);
      } else {
        reject(err);
      }
    });
    archive.on("error", reject);
    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.pipe(writable);

    archive.append(createMimetype(), { name: "mimetype", store: true });

    archive.append(createContainer(), { name: "META-INF/container.xml" });

    const chaptersWithContent = chapters.filter((ch) => ch.content);
    const hasCover = !!metadata.coverImageData;

    archive.append(createContentOpf(metadata, chaptersWithContent, hasCover), {
      name: "OEBPS/content.opf",
    });

    archive.append(createNavXhtml(chaptersWithContent), {
      name: "OEBPS/nav.xhtml",
    });

    archive.append(createStyleCss(), { name: "OEBPS/style.css" });

    if (metadata.coverImageData) {
      const coverBuffer = Buffer.from(metadata.coverImageData, "base64");
      archive.append(coverBuffer, { name: "OEBPS/cover.jpg" });
    }

    chaptersWithContent.forEach((chapter, index) => {
      const xhtml = createChapterXhtml(chapter.title, chapter.content || "", chapter.imageUrls);
      archive.append(xhtml, { name: `OEBPS/chapter${index}.xhtml` });
    });

    archive.finalize();
  });
}

export async function generatePdf(
  metadata: BookMetadata,
  chapters: Chapter[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        info: {
          Title: metadata.title,
          Author: metadata.author,
          Subject: metadata.description || "",
          Creator: "WebToBook",
        },
        bufferPages: false,
      });

      doc.on("data", (chunk: any) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(24).font("Helvetica-Bold").text(metadata.title, {
        align: "center",
      });
      doc.moveDown();
      doc.fontSize(14).font("Helvetica").text(`by ${metadata.author}`, {
        align: "center",
      });
      doc.moveDown(2);

      if (metadata.description) {
        doc.fontSize(10).font("Helvetica-Oblique").text(metadata.description, {
          align: "center",
        });
      }

      doc.addPage();
      doc.fontSize(18).font("Helvetica-Bold").text("Table of Contents", {
        align: "center",
      });
      doc.moveDown();

      const chaptersWithContent = chapters.filter((ch) => ch.content);
      chaptersWithContent.forEach((chapter, index) => {
        doc.fontSize(11).font("Helvetica").text(`${index + 1}. ${chapter.title}`);
        doc.moveDown(0.3);
      });

      chaptersWithContent.forEach((chapter) => {
        doc.addPage();

        doc.fontSize(16).font("Helvetica-Bold").text(chapter.title);
        doc.moveDown();

        const textContent = htmlToText(chapter.content || "", {
          wordwrap: false,
          preserveNewlines: true,
        });

        doc.fontSize(11).font("Helvetica").text(textContent, {
          align: "justify",
          lineGap: 4,
        });
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateHtml(
  metadata: BookMetadata,
  chapters: Chapter[]
): Promise<Buffer> {
  const chaptersHtml = chapters
    .filter((ch) => ch.content)
    .map(
      (ch, idx) => `
    <section id="chapter-${idx}" class="chapter">
      <h2>${escapeXml(ch.title)}</h2>
      <div class="chapter-content">
        ${ch.content}
      </div>
    </section>
  `
    )
    .join("\n");

  const tocHtml = chapters
    .filter((ch) => ch.content)
    .map(
      (ch, idx) =>
        `<li><a href="#chapter-${idx}">${escapeXml(ch.title)}</a></li>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="${metadata.language || "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(metadata.title)}</title>
  <meta name="author" content="${escapeXml(metadata.author)}">
  <meta name="description" content="${escapeXml(metadata.description || "")}">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.7;
      color: #333;
      background: #fafafa;
    }
    header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #eee;
    }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .author { font-size: 1.2rem; color: #666; }
    .description { font-style: italic; color: #888; margin-top: 1rem; }
    nav {
      background: #fff;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 3rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    nav h2 { margin-top: 0; }
    nav ol { padding-left: 1.5rem; }
    nav li { margin: 0.5rem 0; }
    nav a { color: #0066cc; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    .chapter {
      background: #fff;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .chapter h2 {
      margin-top: 0;
      padding-bottom: 1rem;
      border-bottom: 1px solid #eee;
    }
    .chapter-content p { margin: 1rem 0; text-indent: 1.5em; }
    .chapter-content p:first-of-type { text-indent: 0; }
    blockquote {
      border-left: 3px solid #ccc;
      margin-left: 0;
      padding-left: 1rem;
      font-style: italic;
    }
    img { max-width: 100%; height: auto; }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #e0e0e0; }
      .chapter, nav { background: #2a2a2a; }
      h1, h2, h3 { color: #fff; }
      nav a { color: #6ab0ff; }
      .chapter h2 { border-color: #444; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeXml(metadata.title)}</h1>
    <p class="author">by ${escapeXml(metadata.author)}</p>
    ${metadata.description ? `<p class="description">${escapeXml(metadata.description)}</p>` : ""}
  </header>
  
  <nav>
    <h2>Table of Contents</h2>
    <ol>
      ${tocHtml}
    </ol>
  </nav>
  
  <main>
    ${chaptersHtml}
  </main>
  
  <footer style="text-align: center; margin-top: 3rem; color: #888; font-size: 0.9rem;">
    <p>Generated by WebToBook from ${escapeXml(metadata.sourceUrl)}</p>
  </footer>
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}

export async function generateOutput(
  metadata: BookMetadata,
  chapters: Chapter[],
  format: OutputFormatType
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const safeTitle = metadata.title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);

  switch (format) {
    case "epub": {
      const buffer = await generateEpub(metadata, chapters);
      return {
        buffer,
        filename: `${safeTitle}.epub`,
        mimeType: "application/epub+zip",
      };
    }
    case "pdf": {
      const buffer = await generatePdf(metadata, chapters);
      return {
        buffer,
        filename: `${safeTitle}.pdf`,
        mimeType: "application/pdf",
      };
    }
    case "html": {
      const buffer = await generateHtml(metadata, chapters);
      return {
        buffer,
        filename: `${safeTitle}.html`,
        mimeType: "text/html",
      };
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
