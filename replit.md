# WebToBook - Web Novel to EPUB/PDF Converter

## Overview
A powerful web application that converts web novels, books, and online articles to portable book formats (EPUB, PDF, HTML). Features intelligent chapter detection, parallel downloading, and smart format recommendations.

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Styling**: Tailwind CSS + Shadcn/UI components
- **State Management**: TanStack Query for server state
- **Routing**: Wouter

### Backend (Express + Node.js)
- **Web Scraping**: Cheerio for fast HTML parsing
- **Content Detection**: Pattern-based chapter recognition
- **File Generation**: 
  - EPUB: Custom archiver-based generator
  - PDF: PDFKit
  - HTML: Template-based generator

## Key Features
1. **URL Analysis** - Paste any book/novel URL to extract chapters
2. **Chapter Selection** - Choose specific chapters to download
3. **Format Selection** - EPUB, PDF, or HTML output with smart recommendations
4. **Parallel Downloads** - Configurable concurrent downloads for speed
5. **Progress Tracking** - Real-time download progress with ETA
6. **Content Cleaning** - Removes ads, navigation, and unwanted elements

## Project Structure
```
client/
  src/
    components/           # UI components
      url-input.tsx       # URL input with validation
      chapter-list.tsx    # Chapter selection list
      format-selector.tsx # Output format selection
      metadata-display.tsx # Book metadata editor
      settings-panel.tsx  # Download settings
      download-progress.tsx # Progress indicator
      download-queue.tsx  # Active/completed downloads
    pages/
      home.tsx            # Main application page
    lib/
      theme-provider.tsx  # Dark/light mode support

server/
  routes.ts              # API endpoints
  storage.ts             # In-memory job storage
  scraper.ts             # Web scraping engine
  generator.ts           # EPUB/PDF/HTML generation

shared/
  schema.ts              # TypeScript types and Zod schemas
```

## API Endpoints
- `POST /api/analyze` - Analyze URL and extract chapters
- `POST /api/download` - Start download job
- `GET /api/jobs` - Get all download jobs
- `GET /api/jobs/:id` - Get specific job status
- `POST /api/jobs/:id/cancel` - Cancel active download
- `POST /api/jobs/clear-completed` - Clear completed/errored jobs
- `GET /api/download-file/:id` - Download generated file

## User Preferences
- Dark mode support via theme toggle
- Configurable concurrent downloads (1-10)
- Request delay settings (0-2000ms)
- Retry attempts configuration
- Include/exclude images option
- HTML cleanup toggle

## Recent Changes (Dec 20, 2025)
- ✅ Added international chapter detection patterns for Chinese (第1章), Japanese (第1話), Korean (제1화) novels
- ✅ Fixed chapter detection on non-English sites like ixdzs.tw
- 🔄 Identified remaining issue: Sites with hidden/collapsible chapter lists (ixdzs.tw shows only last 8 chapters out of 600+)
- Previous: Initial web-to-EPUB converter implementation
- Previous: EPUB, PDF, and HTML generation support  
- Previous: Dark/light theme support with responsive UI

## Known Limitations
- **Dynamic chapter lists** (e.g., ixdzs.tw): Sites requiring clicking "collapse/expand" buttons to view all chapters need JavaScript rendering. The site hides 600+ chapters behind a JavaScript toggle, showing only 8 by default. **Fix requires:** Puppeteer with valid browser executable path in Replit environment (challenging due to Nix environment isolation)
- **Pagination**: Some sites use paginated or infinite-scroll chapter lists that aren't fully crawled
- **Image processing**: Cover image pipeline temporarily disabled due to missing utilities

## Technical Debt - ixdzs.tw JavaScript Loading
- Current: Cheerio-only parsing captures visible chapters (8 chapters)
- Attempted: Puppeteer with executablePath discovery - failed due to browser path in Nix environment
- Blocker: puppeteer-core requires valid browser executable path; Nix environment isolation makes this complex
- Alternative approaches to explore:
  1. Use playwright instead of puppeteer-core
  2. Manually set PUPPETEER_EXECUTABLE_PATH or CHROMIUM_PATH environment variable
  3. Reverse-engineer ixdzs.tw's JavaScript API calls to get chapter list
  4. Use Replit Shell Terminal to run browser rendering as external service
