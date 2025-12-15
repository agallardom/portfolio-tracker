
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'import', 'etoro_2023.xlsx');
console.log(`Reading: ${filePath}`);

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['Actividad de la cuenta'];
const data = XLSX.utils.sheet_to_json(sheet);

data.forEach((row) => {
    if (row['Tipo'] === 'SDRT') {
        console.log('SDRT Row:', row);
    }
});
