-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "assetCurrency" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pricePerUnitInAssetCurrency" REAL;
