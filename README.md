# HTML to PDF Converter

A Node.js application that converts HTML files to PDF while preserving all CSS styling.

## Features

- 🎨 **Full CSS Preservation** - Uses Puppeteer to render HTML exactly as a browser would
- 📤 **Drag & Drop Upload** - Easy file upload with drag and drop support
- 📊 **Real-time Progress** - Live progress updates during conversion
- 📥 **Instant Download** - Download your PDF immediately after conversion
- 🎯 **Clean UI** - Modern, beautiful interface

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. Open the web interface at `http://localhost:3000`
2. Drag and drop an HTML file or click to browse
3. Click "Convert to PDF"
4. Watch the progress bar
5. Download your PDF when complete

## Tech Stack

- **Express.js** - Web server
- **Puppeteer** - Headless Chrome for HTML rendering
- **Multer** - File upload handling
- **UUID** - Unique file identification

## Notes

- Maximum file size: 10MB
- Supported formats: `.html`, `.htm`
- PDFs are generated in A4 format with 20mm margins
- Background colors and images are preserved

## License

MIT

