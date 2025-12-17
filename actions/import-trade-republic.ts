'use server';

import { prisma } from "@/lib/db";
import YahooFinance from "yahoo-finance2"; // Default instance
import { revalidatePath } from "next/cache";
import { getExchangeRates } from "@/lib/exchange-rates";
import { PDFParse } from 'pdf-parse'; // Type only if needed, dynamic import used later
import path from 'path';
const yahooFinance = new YahooFinance(); // Not needed if using default export instance which is common pattern, checking docs..
// Actually yahoo-finance2 default export is an instance.
// "import yahooFinance from 'yahoo-finance2'" -> yahooFinance.search(...) works directly.
import { createRequire } from 'module';

// Date parsing helper for Spanish months
const MONTHS_ES: { [key: string]: number } = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
};

function parseSpanishDate(dayStr: string, monthStr: string, yearStr: string): Date {
    const day = parseInt(dayStr);
    const month = MONTHS_ES[monthStr.toLowerCase().substring(0, 3)];
    const year = parseInt(yearStr);
    return new Date(Date.UTC(year, month, day));
}

function parseAmount(amountStr: string): number {
    // "15,65" -> 15.65
    return parseFloat(amountStr.replace(',', '.'));
}

// Helper to resolve ISIN to Ticker
async function resolveIsinToTicker(isin: string): Promise<string> {
    // 1. Check if we already have this ISIN in DB
    // 1. Check if we already have this ISIN in DB
    const existing = await prisma.asset.findUnique({
        // @ts-ignore: isin field exists in schema but client types seem stale in editor
        where: { isin: isin }
    });

    // If we have an existing asset and it HAS a proper symbol (not just the ISIN again), use it.
    // If symbol === isin, it means we previously failed to resolve it or imported it raw. Try resolving again.
    if (existing && existing.symbol !== isin) {
        return existing.symbol;
    }

    // 2. Lookup via Yahoo Finance
    try {
        const result = await yahooFinance.search(isin) as any; // Cast to any to avoid type complexity
        if (result.quotes && result.quotes.length > 0) {
            return result.quotes[0].symbol;
        }
    } catch (e) {
        console.warn(`Yahoo lookup failed for ${isin}`, e);
    }

    // 3. Fallback: Use ISIN as symbol if not found
    return isin; // Or "ISIN-" + isin? User wants Ticker. If we fail, maybe ISIN is better than nothing?
    // Using ISIN is redundant but ensures we don't crash.
}

export async function importTradeRepublicPDF(portfolioId: string, formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: 'No file provided' };
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Configure PDF Worker to avoid "Setting up fake worker failed"
        try {
            const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
            // Using dynamic import to match the likely ESM usage
            // The error stack trace explicitly mentioned "legacy/build/pdf.mjs"
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
            console.log('PDF Worker configured:', workerPath);
        } catch (e: any) {
            console.warn("Failed to configure PDF worker:", e.message);
            // Continue, maybe it works anyway or pdf-parse handles it
        }

        let PDFParseVal;

        try {
            // Use dynamic import for ESM/CJS interop
            const pdfModule = await import('pdf-parse');
            // console.log('PDF Module Imported:', Object.keys(pdfModule));

            // v2.4.5 might export it as named export 'PDFParse' or default
            if (pdfModule.PDFParse) {
                PDFParseVal = pdfModule.PDFParse;
            } else if (pdfModule.default) {
                if (typeof pdfModule.default === 'function') {
                    PDFParseVal = pdfModule.default;
                } else if (pdfModule.default.PDFParse) {
                    PDFParseVal = pdfModule.default.PDFParse;
                }
            }

            if (!PDFParseVal && typeof pdfModule === 'function') {
                PDFParseVal = pdfModule;
            }

        } catch (e: any) {
            console.error("Failed to load pdf-parse:", e);
            // Return detailed error for debugging
            return { success: false, error: `Load Error: ${e?.message}\nStack: ${e?.stack}` };
        }

        if (!PDFParseVal) {
            return { success: false, error: 'PDFParse library invalid (import returned null/undefined)' };
        }

        let text = '';
        try {
            const parser = new PDFParseVal({ data: buffer });
            const result = await parser.getText();
            text = result.text;
            await parser.destroy();
        } catch (e: any) {
            // ...
            console.error("PDF Parsing error:", e);
            return { success: false, error: 'Failed to parse PDF content' };
        }

        // --- Parsing Logic ---

        // Split by lines might be tricky because date is multiline "02 dic\n2025"
        // Let's rely on regex matching against full text or normalized text

        // Normalize text: replace newlines with spaces UNLESS it is likely the date break
        // Actually, the regex in plan accounts for \n: `(\d{2} [a-z]{3})\n(\d{4})`

        let count = 0;
        const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
        if (!portfolio) return { success: false, error: 'Portfolio not found' };

        // 1. Savings Plans
        // "02 dic\n2025 Comercio Savings plan execution US6536561086 NICE LTD. ADR/4 O.N., quantity: 0.167379 15,65 € 74,79 €"
        // Regex: 
        // Group 1: Day Month (02 dic)
        // Group 2: Year (2025)
        // Group 3: ISIN (US...)
        const lines = text.split('\n');

        // --- Block Parser Logic ---
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic', 'sept'];
        // Strict Date Start: "DD MMM" or "DD" followed by new block. NOT "2025" or similar year-only lines unless part of date.
        const dateStartRegex = new RegExp(`^(\\d{2})(\\s+(${months.join('|')})|\\s*$)`, 'i');

        interface ParsedBlock {
            date: string;
            type: string;
            description: string;
            rawAmount: number | null;
            balance: number | null;
            fullText: string;
        }

        const parsedBlocks: ParsedBlock[] = [];
        let currentBlock: string[] = [];

        const processBlock = (block: string[]) => {
            if (block.length === 0) return;
            const fullText = block.join(' ');
            if (fullText.length < 10) return; // Skip noise

            // Extract Amounts (last ones are balance/amount)
            const amountMatches: { value: number, index: number }[] = [];
            // Regex for "1.234,56 €" -> extract 1.234,56
            const amtRegex = /([\d.,]+)\s*€/g;
            let match;
            while ((match = amtRegex.exec(fullText)) !== null) {
                // Parse "1.234,56" -> 1234.56
                const valStr = match[1].replace(/\./g, '').replace(',', '.');
                const val = parseFloat(valStr);
                if (!isNaN(val)) {
                    amountMatches.push({ value: val, index: match.index });
                }
            }

            let balance: number | null = null;
            let rawAmount: number | null = null;

            if (amountMatches.length > 0) {
                balance = amountMatches[amountMatches.length - 1].value;
                if (amountMatches.length >= 2) {
                    rawAmount = amountMatches[amountMatches.length - 2].value;
                }
            }

            // Date Parsing
            let dateStr = '';
            // Regex for "DD MMM 20YY" or parts
            const dateMatch = fullText.match(new RegExp(`^(\\d{2})\\s*(${months.join('|')})?\\s*(20\\d{2})?`, 'i'));
            if (dateMatch) {
                let day = dateMatch[1];
                let month = dateMatch[2] || '';
                let year = dateMatch[3] || '';

                if (!month) {
                    const mMatch = fullText.match(new RegExp(`\\s+(${months.join('|')})\\s+`, 'i'));
                    if (mMatch) month = mMatch[1];
                }
                if (!year) {
                    // Try to find year 2024-2030
                    const yMatch = fullText.match(/20[2-3]\d/);
                    if (yMatch) year = yMatch[0];
                }

                // Fallback for spanish month names to English for JS Date
                const spanishMonths: { [key: string]: string } = {
                    'ene': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'abr': 'Apr', 'may': 'May', 'jun': 'Jun',
                    'jul': 'Jul', 'ago': 'Aug', 'sep': 'Sep', 'sept': 'Sep', 'oct': 'Oct', 'nov': 'Nov', 'dic': 'Dec'
                };

                if (spanishMonths[month.toLowerCase()] && year) {
                    dateStr = `${day} ${spanishMonths[month.toLowerCase()]} ${year}`;
                }
            }

            // Type Parsing
            let type = 'Unknown';
            const lowerDesc = fullText.toLowerCase();

            // Priority Keywords
            if (lowerDesc.includes('savings plan execution')) type = 'SAVINGS_PLAN';
            else if (lowerDesc.includes('buy trade')) type = 'BUY_TRADE'; // Standard Order
            else if (lowerDesc.includes('sell trade')) type = 'SELL_TRADE';
            else if (lowerDesc.includes('reembolso por tu regalo')) type = 'GIFT_REWARD';
            else if (lowerDesc.includes('saveback payment')) type = 'GIFT_SAVEBACK'; // "Your Saveback payment"
            else if (lowerDesc.includes('cash dividend')) type = 'DIVIDEND';
            else if (lowerDesc.includes('intereses')) type = 'INTEREST'; // "Pago de intereses"
            else if (lowerDesc.includes('interest payment')) type = 'INTEREST';
            else if (lowerDesc.includes('incoming transfer') || lowerDesc.includes('ingreso aceptado')) type = 'INCOMING_TRANSFER';
            else if (lowerDesc.includes('outgoing transfer')) type = 'OUTGOING_TRANSFER';

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
        processBlock(currentBlock); // Last block

        console.log(`Parsed ${parsedBlocks.length} blocks from PDF.`);

        let importCount = 0;

        // --- Process Blocks into DB ---
        for (const block of parsedBlocks) {
            if (!block.date || !block.rawAmount) continue;

            const dateObj = new Date(block.date);
            if (isNaN(dateObj.getTime())) {
                console.log(`Skipping block with invalid date: ${block.date}`);
                continue;
            }

            // Extract ISIN/Quantity if present
            // Regex: ", quantity: 0.12345"
            // ISIN: 12 chars alphanumeric usually before "Buy/Sell/Savings" or generally available?
            // User example: "Savings plan execution NL0011585146 FERRARI N.V., quantity: 0.012262"
            // ISIN seems to be first word after "execution" or "Buy trade"?
            // "Buy trade IE00BFMXXD54 Vanguard..."

            // Generic ISIN finder: 2 letters + 9 alphanum + 1 digit? Or just any 12 char alphanum starting with 2 letters?
            // Improved ISIN Regex
            const isinMatch = block.description.match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/);
            const isin = isinMatch ? isinMatch[1] : null;

            const qtyMatch = block.description.match(/quantity:\s*([\d.]+)/i);
            const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : null;

            // Extract Asset Name implies everything after ISIN until "quantity:"?
            let assetName = 'Unknown Asset';
            if (isin && block.description.includes(isin)) {
                const afterIsin = block.description.split(isin)[1];
                if (afterIsin) {
                    // Cut off at "quantity" or end amount
                    const endMarker = afterIsin.search(/(quantity:|[\d.,]+\s*€)/);
                    if (endMarker !== -1) {
                        assetName = afterIsin.substring(0, endMarker).replace(/[,|]/g, '').trim();
                    } else {
                        assetName = afterIsin.trim();
                    }
                }
            }

            // Resolve Ticker
            let assetSymbol = null;
            if (isin) {
                assetSymbol = await resolveIsinToTicker(isin);

                // Check for "Old" asset with this ISIN but different Symbol (e.g. old ISIN-based symbol)
                // This prevents Unique constraint failure on 'isin' field when creating the new Ticker-based asset
                // @ts-ignore
                const oldAsset = await prisma.asset.findFirst({
                    // @ts-ignore
                    where: { isin: isin, symbol: { not: assetSymbol } }
                });

                if (oldAsset) {
                    console.log(`Migrating existing asset ${oldAsset.symbol} to new ticker ${assetSymbol}...`);

                    // 1. Ensure new Ticker Asset exists (without setting ISIN yet, to avoid conflict)
                    await prisma.asset.upsert({
                        where: { symbol: assetSymbol },
                        update: {},
                        create: {
                            symbol: assetSymbol,
                            name: assetName, // Use name from block
                            quoteCurrency: 'EUR',
                            currentPrice: 0
                        }
                    });

                    // 2. Move all Transactions from Old Asset to New Asset
                    await prisma.transaction.updateMany({
                        where: { assetSymbol: oldAsset.symbol },
                        data: { assetSymbol: assetSymbol }
                    });

                    // 3. Delete Old Asset to free up the ISIN
                    await prisma.asset.delete({
                        where: { symbol: oldAsset.symbol }
                    });
                }

                // Upsert Asset using Ticker as Symbol (Safe now)
                await prisma.asset.upsert({
                    where: { symbol: assetSymbol },
                    update: {
                        // @ts-ignore
                        isin: isin // Ensure ISIN is saved
                    },
                    create: {
                        symbol: assetSymbol,
                        // @ts-ignore
                        isin: isin,
                        name: assetName,
                        quoteCurrency: 'EUR',
                        currentPrice: 0
                    }
                });
            }

            // --- Mapping Rules ---

            // 1. Savings Plan
            if (block.type === 'SAVINGS_PLAN' && isin && quantity && assetSymbol) {
                // Cost = Money Out (rawAmount)
                // Fee = 0 (assumed)
                const cost = block.rawAmount;
                const pricePerUnit = cost / quantity;

                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'BUY',
                        date: dateObj,
                        amount: cost,
                        currency: 'EUR',
                        quantity: quantity,
                        pricePerUnit: pricePerUnit,
                        assetSymbol: assetSymbol, // TICKER
                        isin: isin,
                        fee: 0,
                        originalCurrency: 'EUR',
                        originalAmount: cost,
                        exchangeRate: 1.0
                    }
                });

                // User requested Deposit for Savings Plan too
                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'DEPOSIT',
                        date: dateObj,
                        amount: cost,
                        currency: 'EUR',
                        fee: 0,
                        exchangeRate: 1.0
                    }
                });
                importCount += 2;
            }

            // 2. Buy Trade (Standard)
            else if (block.type === 'BUY_TRADE' && isin && quantity && assetSymbol) {
                // Cost = Money Out - 1€
                // Fee = 1€
                const cost = block.rawAmount - 1.0;
                const fee = 1.0;
                const pricePerUnit = cost / quantity;

                // Transaction 1: BUY
                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'BUY',
                        date: dateObj,
                        amount: cost,
                        currency: 'EUR',
                        quantity: quantity,
                        pricePerUnit: pricePerUnit,
                        assetSymbol: assetSymbol, // TICKER
                        isin: isin,
                        fee: fee,
                        originalCurrency: 'EUR',
                        originalAmount: cost, // Tracking net cost? Or gross? Usually amount is principal.
                        exchangeRate: 1.0
                    }
                });

                // Transaction 2: DEPOSIT (Covering the full outflow)
                // "Añadir también un depósito de la misma cantidad que el precio de salida" (Meaning rawAmount, i.e. 51€)
                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'DEPOSIT',
                        date: dateObj,
                        amount: block.rawAmount,
                        currency: 'EUR',
                        fee: 0,
                        exchangeRate: 1.0
                    }
                });
                importCount += 2;
            }

            // 3. Sell Trade
            else if (block.type === 'SELL_TRADE' && isin && quantity && assetSymbol) {
                // Assumed Logic: Money In (rawAmount)
                // Fee? Usually 1€ but extracted from total?
                // User didn't specify fee for Sell, assuming similar to Buy?
                // For now, simple mapping: Amount = Money In.
                const proceed = block.rawAmount; // Net proceeds

                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'SELL',
                        date: dateObj,
                        amount: proceed,
                        currency: 'EUR',
                        quantity: quantity,
                        pricePerUnit: proceed / quantity,
                        assetSymbol: assetSymbol, // TICKER
                        isin: isin,
                        exchangeRate: 1.0
                    }
                });
                importCount++;
            }

            // 4. Gifts / Rewards
            else if (block.type === 'GIFT_REWARD' || block.type === 'GIFT_SAVEBACK') {
                // Amount = Money In
                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'GIFT',
                        date: dateObj,
                        amount: block.rawAmount,
                        currency: 'EUR',
                        fee: 0,
                        exchangeRate: 1.0
                    }
                });
                importCount++;
            }

            // 5. Dividends
            else if (block.type === 'DIVIDEND' && isin && assetSymbol) {
                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'DIVIDEND',
                        date: dateObj,
                        amount: block.rawAmount,
                        currency: 'EUR',
                        assetSymbol: assetSymbol, // TICKER
                        isin: isin,
                        fee: 0,
                        exchangeRate: 1.0
                    }
                });
                importCount++;
            }

            // 6. Interest
            else if (block.type === 'INTEREST') {
                await prisma.transaction.create({
                    data: {
                        portfolioId,
                        type: 'INTEREST',
                        date: dateObj,
                        amount: block.rawAmount,
                        currency: 'EUR',
                        fee: 0,
                        exchangeRate: 1.0
                    }
                });
                importCount++;
            }

        }

        revalidatePath(`/portfolio/${portfolioId}`);
        return { success: true, count: importCount };

    } catch (error: any) {
        console.error('Import error:', error);
        return { success: false, error: error.message };
    }
}
