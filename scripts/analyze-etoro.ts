import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const importDir = path.join(process.cwd(), 'import');
const filePath = path.join(importDir, 'etoro_2023.xlsx');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheetNames = workbook.SheetNames;

console.log('Sheets found:', sheetNames);

sheetNames.forEach(sheetName => {
    console.log(`\n--- Structure of sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    // Get range
    const range = XLSX.utils.decode_range(sheet['!ref'] || "A1");
    console.log(`Range: ${sheet['!ref']}`);

    // Read first few rows as JSON to see headers and sample data
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });

    // Print headers (first row)
    if (data.length > 0) {
        console.log('Headers:', data[0]);
    }

    // Print first 3 data rows
    console.log('Sample Data (first 3 rows):');
    data.slice(1, 4).forEach((row, idx) => {
        console.log(`Row ${idx + 2}:`, row);
    });
});
