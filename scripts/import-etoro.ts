import XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

// --- Interfaces ---

interface EtoroTransaction {
    id: string; // Generated UUID
    date: Date;
    type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL' | 'OTHER' | 'GIFT';
    amount: number;
    currency: string;
    assetSymbol: string;
    quantity: number;
    pricePerUnit: number;
    originalId: string; // eToro ID
    details: string; // Original description
    originalAmount?: number;
    originalCurrency?: string;
    exchangeRate?: number;
    // Dividend Tax
    withholdingTax?: number; // USD
    taxRate?: number; // %
    isin?: string;
    assetCurrency?: string;
    fee?: number;
}

// --- Helpers ---

function parseDate(dateStr: string): Date {
    // Format: dd/mm/yyyy HH:mm:ss
    if (!dateStr || typeof dateStr !== 'string') return new Date();

    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute, second] = timePart ? timePart.split(':') : ['00', '00', '00'];

    return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
    );
}

function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Handle strings like "1,234.56" or "1.234,56" depending on locale?
    // Based on log: "105.16" (dot decimal). "3.014534" (string with dot).
    // But wait, "4,46"? 
    // Let's assume dot for now based on '105.16'.
    // If it contains comma and not dot, replace comma with dot.
    let str = val.toString();
    if (str.includes(',') && !str.includes('.')) {
        str = str.replace(',', '.');
    }
    return parseFloat(str);
}

function parseAssetDetails(detail: string): { symbol: string, currency: string | null } {
    if (!detail) return { symbol: 'UNKNOWN', currency: null };

    // Common Mappings
    const mappedSymbols: Record<string, string> = {
        'ITX': 'ITX.MC',
        'MAP': 'MAP.MC',
        'AMS': 'AMS.MC',
        'IBE': 'IBE.MC',
        'MTS': 'MTS.MC',
        'SAN': 'SAN.MC',
        'REP': 'REP.MC',
        'CLNX': 'CLNX.MC',
        'ML': 'ML.PA'
    };

    let symbol = '';
    let currency: string | null = null;

    // Case 1: "Name (Symbol)" format first
    const match = detail.match(/\(([^)]+)\)/);
    if (match) {
        symbol = match[1].trim().toUpperCase();
    }
    // Case 2: "Asset/Currency" format (e.g. ITX/EUR, SHIBxM/USD)
    else if (detail.includes('/')) {
        const parts = detail.split('/');
        symbol = parts[0].trim().toUpperCase();
        currency = parts[1].trim();

        // Case 3: GBX (Penny Sterling) - London Stock Exchange
        if (currency === 'GBX') {
            // Usually these are on LSE, so append .L if not present
            if (!symbol.endsWith('.L')) {
                symbol = `${symbol}.L`;
            }
        }
    } else {
        symbol = detail.trim().toUpperCase();
    }

    // Apply Mappings Globally (e.g. ITX -> ITX.MC)
    if (mappedSymbols[symbol]) {
        symbol = mappedSymbols[symbol];
    }

    return { symbol, currency };
}

// --- Main ---

const importDir = path.join(process.cwd(), 'import');
const filePath = path.join(importDir, 'etoro_2023.xlsx');

const workbook = XLSX.readFile(filePath);

const transactions: EtoroTransaction[] = [];

// 2. Process "Dividendos" sheet to build a lookup map
console.log('Processing Dividends Sheet for Tax details...');
const dividendSheet = workbook.Sheets['Dividendos'];
const dividendData = XLSX.utils.sheet_to_json(dividendSheet);

const dividendMap = new Map<string, any>(); // Key: OriginalID (Position ID)
dividendData.forEach((row: any) => {
    const id = row['ID de posición'];
    if (id) {
        dividendMap.set(id.toString(), row);
    }
});

// 3. Process "Actividad de la cuenta"
console.log('Processing Activity Sheet...');
const activitySheet = workbook.Sheets['Actividad de la cuenta'];
const activityData = XLSX.utils.sheet_to_json(activitySheet);

activityData.forEach((row: any) => {
    const type = row['Tipo'];
    const date = parseDate(row['Fecha']);
    const details = row['Detalles'];
    const amount = parseNumber(row['Importe']);
    const id = row['ID de posición'] ? row['ID de posición'].toString() : null;
    const units = parseNumber(row['Unidades']);

    if (type === 'Posición abierta') {
        const { symbol, currency: assetCurrency } = parseAssetDetails(details);
        transactions.push({
            id: randomUUID(),
            date,
            type: 'BUY',
            amount: amount,
            currency: 'USD', // Assumption
            assetSymbol: symbol,
            quantity: units,
            pricePerUnit: units > 0 ? amount / units : 0,
            originalId: id,
            details: details,
            assetCurrency: assetCurrency || undefined
        });
    } else if (type === 'Dividendo') {
        const { symbol, currency: assetCurrency } = parseAssetDetails(details);
        let withholdingTax = 0;
        let taxRate = 0;
        let isin = null;

        // Lookup in DividendMap
        if (id && dividendMap.has(id)) {
            const divRow = dividendMap.get(id);
            withholdingTax = parseNumber(divRow['Importe de la retención tributaria (USD)']);

            // Parse "19 %" -> 19
            const taxRateStr = divRow['Tasa de retención fiscal (%)'];
            if (taxRateStr && typeof taxRateStr === 'string') {
                taxRate = parseFloat(taxRateStr.replace('%', '').trim());
            }
            isin = divRow['ISIN'];
        }

        transactions.push({
            id: randomUUID(),
            date,
            type: 'DIVIDEND',
            amount: amount, // This is Net amount per analyzing "Actividad"
            currency: 'USD',
            assetSymbol: symbol,
            quantity: 0,
            pricePerUnit: 0,
            originalId: id,
            details: details,
            withholdingTax: withholdingTax,
            taxRate: taxRate,
            isin: isin || undefined,
            assetCurrency: assetCurrency || undefined
        });
    } else if (type === 'Depósito') {
        // Parse "100.00 EUR CreditCard"
        // Regex to find Amount + Currency at start
        const match = details.match(/^([\d\.,]+)\s+([A-Z]{3})/);
        let originalAmount = null;
        let originalCurrency = null;
        let exchangeRate = 1;
        let finalAmount = amount;
        let finalCurrency = 'USD'; // Account currency

        if (match) {
            originalAmount = parseNumber(match[1]);
            originalCurrency = match[2];
            if (originalAmount && originalAmount !== 0) {
                exchangeRate = finalAmount / originalAmount;
            }
        }

        transactions.push({
            id: randomUUID(),
            date,
            type: 'DEPOSIT',
            amount: finalAmount,
            currency: finalCurrency,
            assetSymbol: 'CASH',
            quantity: finalAmount,
            pricePerUnit: 1,
            originalId: id,
            details: details,
            originalAmount: originalAmount || undefined,
            originalCurrency: originalCurrency || undefined,
            exchangeRate: exchangeRate
        });
    } else if (type === 'Ajuste') {
        // Ajuste -> GIFT (e.g. promo bonus)
        transactions.push({
            id: randomUUID(),
            date,
            type: 'GIFT',
            amount: amount,
            currency: 'USD', // Adjustments usually in account currency (USD for eToro)
            assetSymbol: 'CASH', // Gift is cash added to balance
            quantity: amount,
            pricePerUnit: 1,
            originalId: id,
            details: details
        });
    } else if (type === 'Rollover Fee' || type === 'SDRT' || details.includes('SDRT') || details.includes('Stamp Duty')) {
        // Handle Fees (SDRT, Rollover)
        // Treated as Cost Increase (BUY with 0 qty)
        const { symbol, currency: assetCurrency } = parseAssetDetails(details);
        transactions.push({
            id: randomUUID(),
            date,
            type: 'BUY',
            amount: amount, // Fee amount is usually negative in export? No, "Importe" is usually -0.10 for fees.
            // But for "BUY" in our system, amount is Cost.
            // If eToro export shows negative for fee (cash outflow), we take absolute value.
            currency: 'USD',
            assetSymbol: symbol,
            quantity: 0,
            pricePerUnit: 0,
            originalId: id,
            details: details,
            fee: Math.abs(amount) // Explicitly track as fee
            // Using logic: if quantity 0, amount is added to cost.
            // If I set amount = Math.abs(amount), it fits.
        });
    }
});

// 2. Process "Posiciones cerradas" for SELLs
console.log('Processing Closed Positions Sheet...');
const closedSheet = workbook.Sheets['Posiciones cerradas'];
const closedData = XLSX.utils.sheet_to_json(closedSheet);

closedData.forEach((row: any) => {
    // "Posiciones cerradas" represents a SELL event at 'Fecha de cierre'
    const date = parseDate(row['Fecha de cierre']);
    const rawSymbol = row['Acción'];
    const { symbol } = parseAssetDetails(rawSymbol); // Usually "Cellnex (CLNX.MC)" so currency is null here
    const invested = parseNumber(row['Importe']);
    const profit = parseNumber(row['Ganancias (USD)']);
    const totalValue = invested + profit;
    const units = parseNumber(row['Unidades']);
    const id = row['ID de posición'];

    transactions.push({
        id: randomUUID(),
        date,
        type: 'SELL',
        amount: totalValue,
        currency: 'USD',
        assetSymbol: symbol,
        quantity: units,
        pricePerUnit: units > 0 ? totalValue / units : 0,
        originalId: id,
        details: rawSymbol
    });
});

// 3. Process "Dividendos" sheet?
// "Actividad" already has 'Dividendo'. Check if duplicate?
// "Dividendos" sheet has more detail (Tax, etc).
// For now, Actividad seems sufficient for the flow. 
// But "Actividad" might list the *Net* amount?
// "Dividendos" sheet has "Dividendo neto recibido (USD)".
// Sample Actividad: 'Dividendo' ... Importe ???
// Let's stick to Actividad for Dividends to keep timeline consistent, or use proper sheet if missing.
// The sample log for Actividad didn't show a Dividendo row with values.
// Let's rely on Actividad for now as primary timeline.

// --- MERGE FEES STEP ---
// Group by OriginalID to merge separate Fee transactions (like SDRT) into the main BUY/SELL
console.log('Merging Fees into associated transactions...');
const mergedTransactions: EtoroTransaction[] = [];
const byOriginalId = new Map<string, EtoroTransaction[]>();

for (const t of transactions) {
    if (!t.originalId || t.originalId === '-' || t.originalId === '0') {
        mergedTransactions.push(t);
        continue;
    }
    const list = byOriginalId.get(t.originalId) || [];
    list.push(t);
    byOriginalId.set(t.originalId, list);
}

for (const [origId, group] of byOriginalId) {
    // Find main asset transaction (BUY with Quantity > 0)
    // Note: SDRT usually linked to BUY.
    const mainTx = group.find(t => t.type === 'BUY' && t.quantity > 0);

    if (mainTx) {
        // Find fee transactions (BUY 0 qty, with fee)
        const fees = group.filter(t => t !== mainTx && t.type === 'BUY' && t.quantity === 0 && (t.fee || 0) > 0);

        fees.forEach(feeTx => {
            mainTx.fee = (mainTx.fee || 0) + (feeTx.fee || 0);
            // Optional: Append to details?
            // mainTx.details += ` | Fee: ${feeTx.details}`;
        });

        // Add mainTx
        mergedTransactions.push(mainTx);

        // Add others (e.g. non-fee duplicates? or other types if ever they share ID)
        const others = group.filter(t => t !== mainTx && !fees.includes(t));
        mergedTransactions.push(...others);
    } else {
        // No main transaction, keep all
        mergedTransactions.push(...group);
    }
}

// Replace and Sort
transactions.length = 0;
transactions.push(...mergedTransactions);
transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

// 5. Output
const outputPath = path.join(importDir, 'etoro_preview.json');
fs.writeFileSync(outputPath, JSON.stringify(transactions, null, 2));

console.log(`Generated ${transactions.length} transactions.`);
console.log(`Saved preview to: ${outputPath}`);

// Print first 5
// console.log('Preview (First 5):');
// transactions.slice(0, 5).forEach(t => {
//    console.log(`[${t.date.toISOString()}] ${t.type} ${t.assetSymbol} : ${t.amount} ${t.currency}`);
// });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function importToDb() {
    // HARDCODED Portfolio ID for 'eToro' found in previous step
    const PORTFOLIO_ID = 'd26e2ad7-0eee-4b3b-a269-fbee94c020d9';

    console.log(`Starting import to Portfolio ID: ${PORTFOLIO_ID}`);

    // To ensure clean state for Symbol Mappings (ITX -> ITX.MC), let's clear ALL transactions for this Portfolio.
    // The user is importing "the file", implying full sync.
    console.log('Clearing ALL transactions for this portfolio...');
    await prisma.transaction.deleteMany({
        where: {
            portfolioId: PORTFOLIO_ID
        }
    });

    let skipped = 0;
    let created = 0;

    for (const t of transactions) {
        // Special Case: SHIBxM -> SHIB-USD
        // eToro: SHIBxM (1 Unit = 1,000,000 SHIB)
        // Yahoo: SHIB-USD (Price per 1 SHIB)
        // Transformation:
        // Quantity = t.quantity * 1,000,000
        // Price = t.pricePerUnit / 1,000,000
        // Symbol = 'SHIB-USD'

        if (t.assetSymbol === 'SHIBxM') {
            t.assetSymbol = 'SHIB-USD';
            if (t.quantity) t.quantity = t.quantity * 1000000;
            if (t.pricePerUnit) t.pricePerUnit = t.pricePerUnit / 1000000;
        }
        // 1. Skip DEPOSIT/WITHDRAWAL if user only wants asset transactions?
        // User said: "importar los movimientos del portfolio".
        // DEPOSIT is useful for balance, but maybe not vital for "Asset Performance". 
        // Let's include them but without Asset link.

        let assetSymbol: string | null = t.assetSymbol;
        if (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL') {
            assetSymbol = null; // No asset for cash movements
        }

        // 2. Ensure Asset exists if symbol is present
        if (assetSymbol && assetSymbol !== 'CASH') {
            await prisma.asset.upsert({
                where: { symbol: assetSymbol },
                update: {
                    // Update currency if we found a better one (e.g. from details)
                    quoteCurrency: t.assetCurrency || undefined
                },
                create: {
                    symbol: assetSymbol,
                    name: t.details || assetSymbol,
                    quoteCurrency: t.assetCurrency || 'USD', // Use parsed currency or default to USD
                }
            });
        }

        // 3. Check duplicate
        const existing = await prisma.transaction.findFirst({
            where: {
                portfolioId: PORTFOLIO_ID,
                date: t.date,
                type: t.type,
                // amount: t.amount, // Floating point comparison might be risky, but trying exact match
            }
        });

        // Refined duplicate check: Check if amount is very close
        const isDuplicate = existing && Math.abs(existing.amount - t.amount) < 0.01;

        if (isDuplicate) {
            skipped++;
            // console.log(`Skipping duplicate: ${t.date.toISOString()} ${t.type} ${t.assetSymbol}`);
        } else {
            // 4. Create Transaction
            await prisma.transaction.create({
                data: {
                    portfolioId: PORTFOLIO_ID,
                    date: t.date,
                    type: t.type,
                    amount: t.amount,
                    currency: t.currency,
                    assetSymbol: assetSymbol !== 'CASH' ? assetSymbol : undefined,
                    quantity: t.quantity,
                    pricePerUnit: t.pricePerUnit,
                    // Multi-currency support
                    originalAmount: t.originalAmount,
                    originalCurrency: t.originalCurrency,
                    exchangeRate: t.exchangeRate,
                    // Dividend Tax
                    withholdingTax: t.withholdingTax,
                    taxRate: t.taxRate,
                    isin: t.isin,

                    assetCurrency: t.assetCurrency
                    // Store original details if possible? schema doesn't have it, ignoring.
                }
            });
            created++;
        }
    }

    console.log(`Import Complete.`);
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
}

importToDb()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
