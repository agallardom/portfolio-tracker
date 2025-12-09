"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type TransactionData = {
    date: Date;
    type: string;
    amount: number;
    currency: string;
    assetSymbol?: string;
    pricePerUnit?: number;
    quantity?: number;
    fee?: number;
    exchangeRate?: number;
    portfolioId: string;
};

export async function createTransaction(data: TransactionData) {
    try {
        // If assetSymbol provided, ensure asset exists or create it
        if (data.assetSymbol) {
            await prisma.asset.upsert({
                where: { symbol: data.assetSymbol },
                update: { updatedAt: new Date() }, // Just touch it
                create: { symbol: data.assetSymbol, name: data.assetSymbol },
            });
        }

        const transaction = await prisma.transaction.create({
            data: {
                date: data.date,
                type: data.type,
                amount: data.amount,
                currency: data.currency,
                assetSymbol: data.assetSymbol,
                pricePerUnit: data.pricePerUnit,
                quantity: data.quantity,
                fee: data.fee,
                exchangeRate: data.exchangeRate,
                portfolioId: data.portfolioId,
            },
        });

        revalidatePath("/");
        revalidatePath("/portfolio/[id]");
        return { success: true, data: transaction };
    } catch (error) {
        console.error("Create transaction error:", error);
        return { success: false, error: "Failed to create transaction" };
    }
}

export async function updateTransaction(id: string, data: TransactionData) {
    try {
        if (data.assetSymbol) {
            await prisma.asset.upsert({
                where: { symbol: data.assetSymbol },
                update: { updatedAt: new Date() },
                create: { symbol: data.assetSymbol, name: data.assetSymbol },
            });
        }

        const transaction = await prisma.transaction.update({
            where: { id },
            data: {
                date: data.date,
                type: data.type,
                amount: data.amount,
                currency: data.currency,
                assetSymbol: data.assetSymbol,
                pricePerUnit: data.pricePerUnit,
                quantity: data.quantity,
                fee: data.fee,
                exchangeRate: data.exchangeRate,
            },
        });

        revalidatePath("/");
        revalidatePath("/portfolio/[id]");
        return { success: true, data: transaction };
    } catch (error) {
        console.error("Update transaction error:", error);
        return { success: false, error: "Failed to update transaction" };
    }
}

export async function getTransactions(portfolioId: string) {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { portfolioId },
            orderBy: { date: 'desc' },
            include: { asset: true }
        });
        return { success: true, data: transactions };
    } catch (error) {
        return { success: false, error: "Failed to fetch transactions" };
    }
}
