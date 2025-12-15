
import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'import', 'etoro_2023.xlsx');
console.log(`Reading: ${filePath}`);
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['Actividad de la cuenta'];
const data = XLSX.utils.sheet_to_json(sheet);

const types = new Set<string>();
const sdrtRows: any[] = [];

data.forEach((row: any) => {
    const type = row['Tipo'];
    const details = row['Detalles'];
    if (type) types.add(type);
    if (details && (details.includes('SDRT') || details.includes('Stamp Duty'))) {
        sdrtRows.push(row);
    }
});

console.log('Unique Types:', Array.from(types));
console.log('SDRT Rows Found:', sdrtRows);
