import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

interface ParsedBlock {
    date: string;
    type: string;
    description: string;
    rawAmount: number | null;
    balance: number | null;
    fullText: string;
    isin?: string;
    ticker?: string;
    resolvedName?: string;
}

const inputPath = path.join(process.cwd(), 'import', 'trade_republic_debug.json');
if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const lines = rawData.lines;

// --- Block Parser Logic (Same as Server Action) ---
const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic', 'sept'];
const dateStartRegex = new RegExp(`^(\\d{2})(\\s+(${months.join('|')})|\\s*$)`, 'i');

const parsedBlocks: ParsedBlock[] = [];
let currentBlock: string[] = [];

const processBlock = (block: string[]) => {
    if (block.length === 0) return;
    const fullText = block.join(' ');
    if (fullText.length < 10) return;

    // Extract Amounts
    const amtRegex = /([\d.,]+)\s*€/g;
    const amountMatches: { value: number, index: number }[] = [];
    let match;
    while ((match = amtRegex.exec(fullText)) !== null) {
        const valStr = match[1].replace(/\./g, '').replace(',', '.');
        const val = parseFloat(valStr);
        if (!isNaN(val)) amountMatches.push({ value: val, index: match.index });
    }

    let balance: number | null = null;
    let rawAmount: number | null = null;

    if (amountMatches.length > 0) {
        balance = amountMatches[amountMatches.length - 1].value;
        if (amountMatches.length >= 2) rawAmount = amountMatches[amountMatches.length - 2].value;
    }

    // Date Parsing
    let dateStr = '';
    const dateMatch = fullText.match(new RegExp(`^(\\d{2})\\s*(${months.join('|')})?\\s*(20\\d{2})?`, 'i'));
    if (dateMatch) {
        let day = dateMatch[1];
        let month = dateMatch[2] || '';
        let year = dateMatch[3] || '';

        const spanishMonths: { [key: string]: string } = {
            'ene': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'abr': 'Apr', 'may': 'May', 'jun': 'Jun',
            'jul': 'Jul', 'ago': 'Aug', 'sep': 'Sep', 'sept': 'Sep', 'oct': 'Oct', 'nov': 'Nov', 'dic': 'Dec'
        };

        if (!month) {
            const mMatch = fullText.match(new RegExp(`\\s+(${months.join('|')})\\s+`, 'i'));
            if (mMatch) month = mMatch[1];
        }
        if (!year) {
            const yMatch = fullText.match(/20[2-3]\d/);
            if (yMatch) year = yMatch[0];
        }
        if (spanishMonths[month.toLowerCase()] && year) {
            dateStr = `${day} ${spanishMonths[month.toLowerCase()]} ${year}`;
        }
    }

    // Type Parsing
    let type = 'Unknown';
    const lowerDesc = fullText.toLowerCase();
    if (lowerDesc.includes('savings plan execution')) type = 'SAVINGS_PLAN';
    else if (lowerDesc.includes('buy trade')) type = 'BUY_TRADE';
    else if (lowerDesc.includes('sell trade')) type = 'SELL_TRADE';
    else if (lowerDesc.includes('reembolso por tu regalo')) type = 'GIFT_REWARD';
    else if (lowerDesc.includes('saveback payment')) type = 'GIFT_SAVEBACK';
    else if (lowerDesc.includes('cash dividend')) type = 'DIVIDEND';
    else if (lowerDesc.includes('intereses') || lowerDesc.includes('interest payment')) type = 'INTEREST';
    else if (lowerDesc.includes('incoming transfer') || lowerDesc.includes('ingreso aceptado')) type = 'INCOMING_TRANSFER';

    parsedBlocks.push({
        date: dateStr,
        type,
        description: fullText,
        rawAmount,
        balance,
        fullText
    });
};

for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;
    if (cleanLine.includes("TRADE REPUBLIC BANK") || cleanLine.includes("Página")) continue;

    if (dateStartRegex.test(cleanLine)) {
        processBlock(currentBlock);
        currentBlock = [cleanLine];
    } else {
        currentBlock.push(cleanLine);
    }
}
processBlock(currentBlock);

console.log(`Parsed ${parsedBlocks.length} blocks. Resolving Tickers...`);

// Resolve Tickers
async function resolve() {
    for (const block of parsedBlocks) {
        const isinMatch = block.description.match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/);
        if (isinMatch) {
            const isin = isinMatch[1];
            block.isin = isin;
            try {
                // console.log(`Searching ISIN: ${isin}`);
                const result = await yahooFinance.search(isin) as any;
                if (result.quotes && result.quotes.length > 0) {
                    block.ticker = result.quotes[0].symbol;
                    block.resolvedName = result.quotes[0].shortname;
                } else {
                    block.ticker = 'NOT_FOUND';
                }
            } catch (e) {
                console.warn(`Failed to resolve ${isin}`);
            }
        }
    }

    // Output Grid Format for User Review (matching old format but with new fields)
    const outputGrid = parsedBlocks.map(b => ({
        date: b.date,
        type: b.type,
        description: b.description,
        isin: b.isin || null,
        ticker: b.ticker || null,

        moneyIn: (b.rawAmount && (b.type === 'GIFT_REWARD' || b.type === 'GIFT_SAVEBACK' || b.type === 'SELL_TRADE' || b.type === 'DIVIDEND' || b.type === 'INTEREST')) ?
            b.rawAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : null,

        moneyOut: (b.rawAmount && (b.type === 'BUY_TRADE' || b.type === 'SAVINGS_PLAN')) ?
            b.rawAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : null,

        balance: b.balance ? b.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : null
    }));

    const outputPath = path.join(process.cwd(), 'import', 'trade_republic_parsed.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputGrid, null, 2));
    console.log(`Updated JSON saved to: ${outputPath}`);
}

resolve();
