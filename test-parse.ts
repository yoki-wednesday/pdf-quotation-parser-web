import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseEstimateText } from './src/lib/parser';

async function extractTextFromPDF(pdfPath: string) {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }
    
    console.log('--- RAW TEXT ---');
    console.log(fullText);
    
    console.log('\n--- PARSED RESULT ---');
    const result = parseEstimateText(fullText);
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error extracting text:', error);
  }
}

const pdfPath = process.argv[2];
if (pdfPath) {
  extractTextFromPDF(pdfPath);
} else {
  console.log('Please provide a PDF path');
}
