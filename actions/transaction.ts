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
    originalCurrency?: string;
    originalAmount?: number;
    assetCurrency?: string;
    pricePerUnitInAssetCurrency?: number;
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
                originalCurrency: data.originalCurrency,
                originalAmount: data.originalAmount,
                assetCurrency: data.assetCurrency,
                pricePerUnitInAssetCurrency: data.pricePerUnitInAssetCurrency,
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
                originalCurrency: data.originalCurrency,
                originalAmount: data.originalAmount,
                assetCurrency: data.assetCurrency,
                pricePerUnitInAssetCurrency: data.pricePerUnitInAssetCurrency,
                portfolioId: data.portfolioId,
            },
        }); revalidatePath("/");
        revalidatePath("/portfolio/[id]");
        return { success: true, data: transaction };
    } catch (error) {
        console.error("Update transaction error:", error);
        return { success: false, error: "Failed to update transaction" };
    }
}

export async function getTransactions(portfolioId: string, page: number = 1, pageSize: number = 20) {
    try {
        const skip = (page - 1) * pageSize;

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where: { portfolioId },
                orderBy: { date: 'desc' },
                include: { asset: true },
                skip,
                take: pageSize,
            }),
            prisma.transaction.count({
                where: { portfolioId },
            })
        ]);

        const totalPages = Math.ceil(total / pageSize);

        return {
            success: true,
            data: transactions,
            metadata: {
                total,
                page,
                pageSize,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    } catch (error) {
        return { success: false, error: "Failed to fetch transactions" };
    }
}

export async function deleteTransaction(id: string) {
    try {
        await prisma.transaction.delete({
            where: { id }
        });

        revalidatePath("/");
        revalidatePath("/portfolio/[id]");
        return { success: true };
    } catch (error) {
        console.error("Delete transaction error:", error);
        return { success: false, error: "Failed to delete transaction" };
    }
}

export async function deleteAllTransactions(portfolioId: string) {
    try {
        await prisma.transaction.deleteMany({
            where: { portfolioId }
        });

        revalidatePath("/");
        revalidatePath(`/portfolio/${portfolioId}`);
        return { success: true };
    } catch (error) {
        console.error("Delete all transactions error:", error);
        return { success: false, error: "Failed to delete all transactions" };
    }
}
