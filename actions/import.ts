'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';

interface EtoroTransaction {
    id: string;
    date: Date;
    type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL' | 'OTHER' | 'GIFT';
    amount: number;
    currency: string;
    assetSymbol: string;
    quantity: number;
    pricePerUnit: number;
    originalId: string;
    details: string;
    originalAmount?: number;
    originalCurrency?: string;
    exchangeRate?: number;
    withholdingTax?: number;
    taxRate?: number;
    isin?: string;
    assetCurrency?: string;
}

function parseDate(dateStr: string): Date {
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
    let str = val.toString();
    if (str.includes(',') && !str.includes('.')) {
        str = str.replace(',', '.');
    }
    return parseFloat(str);
}

function parseAssetDetails(detail: string): { symbol: string, currency: string | null } {
    if (!detail) return { symbol: 'UNKNOWN', currency: null };

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
    // Case 2: "Asset/Currency" format
    else if (detail.includes('/')) {
        const parts = detail.split('/');
        symbol = parts[0].trim().toUpperCase();
        currency = parts[1].trim();

        if (currency === 'GBX') {
            if (!symbol.endsWith('.L')) {
                symbol = `${symbol}.L`;
            }
        }
    } else {
        symbol = detail.trim().toUpperCase();
    }

    if (mappedSymbols[symbol]) {
        symbol = mappedSymbols[symbol];
    }

    return { symbol, currency };
}

export async function importEtoroTransactions(portfolioId: string, formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: 'No file provided' };
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const transactions: EtoroTransaction[] = [];

        // 1. Process Dividends Sheet
        const dividendSheet = workbook.Sheets['Dividendos'];
        const dividendMap = new Map<string, any>();
        if (dividendSheet) {
            const dividendData = XLSX.utils.sheet_to_json(dividendSheet);
            dividendData.forEach((row: any) => {
                const id = row['ID de posición'];
                if (id) dividendMap.set(id.toString(), row);
            });
        }

        // 2. Process Activity Sheet
        const activitySheet = workbook.Sheets['Actividad de la cuenta'];
        if (!activitySheet) {
            return { success: false, error: 'Missing "Actividad de la cuenta" sheet' };
        }
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
                    currency: 'USD',
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

                if (id && dividendMap.has(id)) {
                    const divRow = dividendMap.get(id);
                    withholdingTax = parseNumber(divRow['Importe de la retención tributaria (USD)']);
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
                    amount: amount,
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
                const match = details.match(/^([\d\.,]+)\s+([A-Z]{3})/);
                let originalAmount = null;
                let originalCurrency = null;
                let exchangeRate = 1;

                if (match) {
                    originalAmount = parseNumber(match[1]);
                    originalCurrency = match[2];
                    if (originalAmount && originalAmount !== 0) {
                        exchangeRate = amount / originalAmount;
                    }
                }

                transactions.push({
                    id: randomUUID(),
                    date,
                    type: 'DEPOSIT',
                    amount: amount,
                    currency: 'USD',
                    assetSymbol: 'CASH',
                    quantity: amount,
                    pricePerUnit: 1,
                    originalId: id,
                    details: details,
                    originalAmount: originalAmount || undefined,
                    originalCurrency: originalCurrency || undefined,
                    exchangeRate: exchangeRate
                });
            } else if (type === 'Ajuste') {
                transactions.push({
                    id: randomUUID(),
                    date,
                    type: 'GIFT',
                    amount: amount,
                    currency: 'USD',
                    assetSymbol: 'CASH',
                    quantity: amount,
                    pricePerUnit: 1,
                    originalId: id,
                    details: details
                });
            }
        });

        // 3. Process Closed Positions
        const closedSheet = workbook.Sheets['Posiciones cerradas'];
        if (closedSheet) {
            const closedData = XLSX.utils.sheet_to_json(closedSheet);
            closedData.forEach((row: any) => {
                const date = parseDate(row['Fecha de cierre']);
                const rawSymbol = row['Acción'];
                const { symbol } = parseAssetDetails(rawSymbol);
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
        }

        // 4. Sort
        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        // 5. DB Operations
        // Clear Existing (Full Sync)
        await prisma.transaction.deleteMany({
            where: { portfolioId: portfolioId }
        });

        let createdCount = 0;

        for (const t of transactions) {
            // SHIB Conversion
            if (t.assetSymbol === 'SHIBxM') {
                t.assetSymbol = 'SHIB-USD';
                if (t.quantity) t.quantity = t.quantity * 1000000;
                if (t.pricePerUnit) t.pricePerUnit = t.pricePerUnit / 1000000;
            }

            let assetSymbol: string | null = t.assetSymbol;
            if (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL' || t.type === 'GIFT') {
                assetSymbol = null;
            }

            if (assetSymbol && assetSymbol !== 'CASH') {
                await prisma.asset.upsert({
                    where: { symbol: assetSymbol },
                    update: {
                        quoteCurrency: t.assetCurrency || undefined
                    },
                    create: {
                        symbol: assetSymbol,
                        name: t.details || assetSymbol,
                        quoteCurrency: t.assetCurrency || 'USD',
                    }
                });
            }

            await prisma.transaction.create({
                data: {
                    portfolioId: portfolioId,
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
                }
            });
            createdCount++;
        }

        revalidatePath(`/portfolio/${portfolioId}`);
        return { success: true, count: createdCount };

    } catch (error) {
        console.error('Import error:', error);
        return { success: false, error: 'Failed to process file' };
    }
}
