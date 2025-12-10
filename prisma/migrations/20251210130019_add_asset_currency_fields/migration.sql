-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "exchangeRateToEUR" REAL;
ALTER TABLE "Asset" ADD COLUMN "exchangeRateToUSD" REAL;
ALTER TABLE "Asset" ADD COLUMN "quoteCurrency" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "originalAmount" REAL;
ALTER TABLE "Transaction" ADD COLUMN "originalCurrency" TEXT;
