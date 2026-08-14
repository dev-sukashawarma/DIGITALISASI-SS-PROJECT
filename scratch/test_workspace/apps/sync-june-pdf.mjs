
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const dir = 'D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\SS COGS SET\\DATA RANGKUMAN MITRA JUNI';

async function parsePdfs() {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
  
  for (const file of files) {
    const dataBuffer = fs.readFileSync(path.join(dir, file));
    const data = await pdfParse(dataBuffer);
    console.log('--- ' + file + ' ---');
    console.log(data.text);
  }
}

parsePdfs().catch(console.error);
