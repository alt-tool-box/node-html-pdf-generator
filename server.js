const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.html' || ext === '.htm') {
            cb(null, true);
        } else {
            cb(new Error('Only HTML files are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Store conversion progress
const conversionProgress = new Map();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(outputDir));

// API endpoint to check conversion progress
app.get('/api/progress/:id', (req, res) => {
    const { id } = req.params;
    const progress = conversionProgress.get(id) || { status: 'unknown', progress: 0 };
    res.json(progress);
});

// API endpoint to convert HTML to PDF
app.post('/api/convert', upload.single('htmlFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get PDF options from request
    const pageSize = req.body.pageSize || 'A4';
    const orientation = req.body.orientation || 'portrait';
    const marginOption = req.body.margin || 'normal';
    const scale = parseFloat(req.body.scale) || 1;

    // Map margin options to actual values
    const marginMap = {
        'none': { top: '0', right: '0', bottom: '0', left: '0' },
        'narrow': { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        'normal': { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        'wide': { top: '25mm', right: '25mm', bottom: '25mm', left: '25mm' }
    };
    const margins = marginMap[marginOption] || marginMap['normal'];

    const conversionId = uuidv4();
    const htmlFilePath = req.file.path;
    const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const pdfFileName = `${originalName}-${conversionId.slice(0, 8)}.pdf`;
    const pdfFilePath = path.join(outputDir, pdfFileName);

    // Initialize progress
    conversionProgress.set(conversionId, { 
        status: 'starting', 
        progress: 0,
        message: 'Initializing conversion...'
    });

    // Send conversion ID immediately
    res.json({ conversionId, message: 'Conversion started' });

    // Process conversion asynchronously
    try {
        // Update progress: Launching browser
        conversionProgress.set(conversionId, { 
            status: 'processing', 
            progress: 20,
            message: 'Launching browser engine...'
        });

        const browser = await puppeteer.launch({
            headless: true,
            channel: 'chrome', // Use installed Chrome
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        // Update progress: Creating page
        conversionProgress.set(conversionId, { 
            status: 'processing', 
            progress: 40,
            message: 'Loading HTML content...'
        });

        const page = await browser.newPage();

        // Read HTML content
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');

        // Set content with proper base URL for relative resources
        await page.setContent(htmlContent, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000
        });

        // Update progress: Rendering
        conversionProgress.set(conversionId, { 
            status: 'processing', 
            progress: 60,
            message: 'Rendering PDF...'
        });

        // Wait for any fonts and images to load
        await page.evaluateHandle('document.fonts.ready');

        // Inject CSS to prevent page break issues
        await page.addStyleTag({
            content: `
                /* Prevent page breaks inside these elements */
                img, svg, figure, picture, video, canvas,
                table, thead, tbody, tfoot, tr,
                pre, code, blockquote,
                .no-break, .avoid-break,
                [data-no-break], [data-avoid-break] {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }

                /* Prevent orphan/widow lines */
                p, li, h1, h2, h3, h4, h5, h6 {
                    orphans: 3 !important;
                    widows: 3 !important;
                }

                /* Keep headings with their content */
                h1, h2, h3, h4, h5, h6 {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }

                /* Ensure images don't overflow pages */
                img, svg, figure, picture {
                    max-height: 100vh !important;
                    object-fit: contain !important;
                }

                /* Keep table headers with table body */
                thead {
                    display: table-header-group !important;
                }
                tfoot {
                    display: table-footer-group !important;
                }

                /* Avoid breaking inside card-like elements */
                article, section, aside, .card, .box, .panel,
                .container, .wrapper, .block, .item, .entry {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }

                /* Force page breaks where explicitly requested */
                .page-break, .page-break-before, [data-page-break] {
                    page-break-before: always !important;
                    break-before: page !important;
                }
                .page-break-after {
                    page-break-after: always !important;
                    break-after: page !important;
                }

                /* Ensure flexbox and grid items don't break */
                [style*="display: flex"] > *,
                [style*="display:flex"] > *,
                [style*="display: grid"] > *,
                [style*="display:grid"] > * {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }

                /* Print-specific adjustments */
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                }
            `
        });

        // Update progress: Generating PDF
        conversionProgress.set(conversionId, { 
            status: 'processing', 
            progress: 80,
            message: 'Generating PDF file...'
        });

        // Generate PDF with user-specified settings
        await page.pdf({
            path: pdfFilePath,
            format: pageSize,
            printBackground: true,
            margin: margins,
            preferCSSPageSize: false, // Use our specified size
            displayHeaderFooter: false,
            scale: scale,
            landscape: orientation === 'landscape'
        });

        await browser.close();

        // Clean up uploaded HTML file
        fs.unlinkSync(htmlFilePath);

        // Update progress: Complete
        conversionProgress.set(conversionId, { 
            status: 'completed', 
            progress: 100,
            message: 'Conversion completed!',
            downloadUrl: `/output/${pdfFileName}`,
            fileName: pdfFileName
        });

        // Clean up progress after 10 minutes
        setTimeout(() => {
            conversionProgress.delete(conversionId);
        }, 10 * 60 * 1000);

    } catch (error) {
        console.error('Conversion error:', error);
        conversionProgress.set(conversionId, { 
            status: 'error', 
            progress: 0,
            message: `Conversion failed: ${error.message}`
        });

        // Clean up uploaded file on error
        if (fs.existsSync(htmlFilePath)) {
            fs.unlinkSync(htmlFilePath);
        }
    }
});

// API endpoint to download PDF
app.get('/api/download/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(outputDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Download error:', err);
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 PDF Generator Server Running                      ║
║                                                        ║
║   Local:   http://localhost:${PORT}                      ║
║                                                        ║
║   Ready to convert HTML to PDF!                        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
});

