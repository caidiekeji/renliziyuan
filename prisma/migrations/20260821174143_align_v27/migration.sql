-- CreateEnum
CREATE TYPE "ReviewScope" AS ENUM ('JOB', 'HOURLY');

-- CreateEnum
CREATE TYPE "HourlyApplicationStatus" AS ENUM ('APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobBiddingBoostStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BoostJobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT', 'HOURLY');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('RECHARGE', 'CONSUME', 'FREEZE', 'UNFREEZE', 'REFUND', 'ADJUST');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BOOST_OVERTAKEN';

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_conversation_id_fkey";

-- DropIndex
DROP INDEX "Review_reviewer_id_conversation_id_key";

-- AlterTable
ALTER TABLE "CompanyMember" ADD COLUMN     "is_primary_contact" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "applied_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hourly_rate" DECIMAL(10,2),
ADD COLUMN     "is_hourly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slots" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "work_period" VARCHAR(100);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "hourly_application_id" UUID,
ADD COLUMN     "reply_by" UUID,
ADD COLUMN     "scope" "ReviewScope" NOT NULL DEFAULT 'JOB',
ALTER COLUMN "conversation_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SiteConfig" ADD COLUMN     "boost_cancel_limit_per_day" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "boost_create_limit_per_day" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "boost_min_bid" DECIMAL(10,2) NOT NULL DEFAULT 1,
ADD COLUMN     "call_logs_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hourly_review_min_hours" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "HourlyJobApplication" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "HourlyApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HourlyJobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobBiddingBoost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "job_type" "BoostJobType",
    "bid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "JobBiddingBoostStatus" NOT NULL DEFAULT 'PENDING',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "JobBiddingBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyWallet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "frozen" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_recharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_consume" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CompanyWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "order_no" VARCHAR(64),
    "description" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(50) NOT NULL,
    "title_template" VARCHAR(100) NOT NULL,
    "body_template" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(50) NOT NULL,
    "template_id" UUID NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY['INAPP']::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HourlyJobApplication_user_id_status_idx" ON "HourlyJobApplication"("user_id", "status");

-- CreateIndex
CREATE INDEX "HourlyJobApplication_job_id_status_idx" ON "HourlyJobApplication"("job_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyJobApplication_job_id_user_id_key" ON "HourlyJobApplication"("job_id", "user_id");

-- CreateIndex
CREATE INDEX "JobBiddingBoost_city_status_bid_idx" ON "JobBiddingBoost"("city", "status", "bid" DESC);

-- CreateIndex
CREATE INDEX "JobBiddingBoost_company_id_status_idx" ON "JobBiddingBoost"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobBiddingBoost_job_id_city_key" ON "JobBiddingBoost"("job_id", "city");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyWallet_company_id_key" ON "CompanyWallet"("company_id");

-- CreateIndex
CREATE INDEX "CompanyWallet_company_id_idx" ON "CompanyWallet"("company_id");

-- CreateIndex
CREATE INDEX "WalletTransaction_company_id_idx" ON "WalletTransaction"("company_id");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_created_at_idx" ON "WalletTransaction"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_event_type_key" ON "NotificationTemplate"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRule_event_type_key" ON "NotificationRule"("event_type");

-- CreateIndex
CREATE INDEX "Review_scope_idx" ON "Review"("scope");

-- CreateIndex
CREATE INDEX "Review_reviewer_id_scope_idx" ON "Review"("reviewer_id", "scope");

-- AddForeignKey
ALTER TABLE "HourlyJobApplication" ADD CONSTRAINT "HourlyJobApplication_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyJobApplication" ADD CONSTRAINT "HourlyJobApplication_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBiddingBoost" ADD CONSTRAINT "JobBiddingBoost_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBiddingBoost" ADD CONSTRAINT "JobBiddingBoost_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyWallet" ADD CONSTRAINT "CompanyWallet_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_hourly_application_id_fkey" FOREIGN KEY ("hourly_application_id") REFERENCES "HourlyJobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reply_by_fkey" FOREIGN KEY ("reply_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "NotificationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
