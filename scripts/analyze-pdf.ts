import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
// const pdfImport = await import('pdf-parse');

async function main() {
    const pdfImport = await import('pdf-parse');
    console.log('PDF module imported:', Object.keys(pdfImport));
    const pdf = pdfImport.default || pdfImport;
    const filePath = path.join(process.cwd(), 'import', 'Trade Republic 2025.pdf');

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const dataBuffer = fs.readFileSync(filePath);

    try {
        console.log('Using PDFParse v2 API...');
        const PDFParse = pdf.PDFParse;

        try {
            const parser = new PDFParse({ data: dataBuffer });
            // console.log('Parser instantiated.');
            const result = await parser.getText();

            // Save to JSON for user inspection
            const debugOutput = {
                numpages: result.numpages,
                text: result.text,
                lines: result.text.split('\n')
            };

            const outputPath = path.join(process.cwd(), 'import', 'trade_republic_debug.json');
            fs.writeFileSync(outputPath, JSON.stringify(debugOutput, null, 2));
            console.log(`Debug JSON saved to: ${outputPath}`);

            console.log("---------------- TEXT CONTENT START ----------------");
            console.log(result.text);
            console.log("---------------- TEXT CONTENT END ----------------");
            await parser.destroy();
        } catch (e: any) {
            console.error('Parser error:', e);
        }

    } catch (error) {
        console.error("Error parsing PDF:", error);
    }
}

main();
