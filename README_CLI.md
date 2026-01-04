# WebToBook CLI

Convert web novels and manga to EPUB directly from your terminal.

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Run the CLI tool with any supported URL:

```bash
npx tsx server/cli.ts "https://example.com/your-book-url"
```

## Features
- **Automatic Detection**: Works for both novels and manga.
- **Smart Formatting**: Creates vertical scroll EPUBs for manga.
- **Limits**: Automatically processes up to 2,000 chapters.
- **Output**: Saves the generated `.epub` file to your current directory.

## Requirements
- Node.js 18+
- NPM
