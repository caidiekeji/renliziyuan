-- AlterTable
ALTER TABLE "PaymentConfig" ALTER COLUMN "app_secret_enc" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SmsConfig" ALTER COLUMN "secret_enc" SET DATA TYPE TEXT;