-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CANDIDATE', 'COMPANY', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "CompanyVerifyStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'HR', 'VIEWER');

-- CreateEnum
CREATE TYPE "CompanyMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JobClosedReason" AS ENUM ('ADMIN', 'COMPANY', 'QUOTA_EXCEEDED', 'AUDIT_REJECTED');

-- CreateEnum
CREATE TYPE "JobAuditStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalaryUnit" AS ENUM ('MONTH_K', 'DAY_YUAN');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT');

-- CreateEnum
CREATE TYPE "Experience" AS ENUM ('FRESH', 'Y1_3', 'Y3_5', 'Y5');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('COMPANY', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('ALIPAY', 'WECHAT', 'STRIPE');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('COMPANY', 'JOB', 'REVIEW', 'USER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'HANDLED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "UserEventType" AS ENUM ('VIEW', 'FAVORITE', 'CHAT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MESSAGE', 'NEW_REVIEW', 'REVIEW_REPLY', 'JOB_AUDIT', 'COMPANY_VERIFY', 'PLAN_EXPIRE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('INAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('BANNER', 'NOTICE');

-- CreateEnum
CREATE TYPE "AuditMode" AS ENUM ('PRE', 'POST');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('FULL', 'SCHEMA_DATA');

-- CreateEnum
CREATE TYPE "BackupFormat" AS ENUM ('SQL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DbBackupType" AS ENUM ('MANUAL', 'AUTO', 'PRE_RESTORE_SNAPSHOT');

-- CreateEnum
CREATE TYPE "DbBackupStatus" AS ENUM ('RUNNING', 'OK', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PolicySource" AS ENUM ('REGISTER', 'LOGIN', 'IN_APP_PROMPT');

-- CreateEnum
CREATE TYPE "SensitiveWordScope" AS ENUM ('ALL', 'JOB', 'REVIEW', 'CHAT');

-- CreateEnum
CREATE TYPE "SmsProviderType" AS ENUM ('ALIYUN', 'TENCENT', 'VOLCENGINE');

-- CreateEnum
CREATE TYPE "SmsPurpose" AS ENUM ('LOGIN', 'RESET');

-- CreateEnum
CREATE TYPE "SeekerPostStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SeekerPostClosedReason" AS ENUM ('USER_DELETED', 'USER_CLOSED');

-- CreateEnum
CREATE TYPE "CallLogType" AS ENUM ('JOB', 'SEEKER_POST');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "name" VARCHAR(50) NOT NULL,
    "avatar" VARCHAR(500),
    "bio" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CANDIDATE',
    "title" VARCHAR(100),
    "city" VARCHAR(50),
    "skills" TEXT[],
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "chat_muted_until" TIMESTAMPTZ,
    "refresh_token_version" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneReleasePool" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "released_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "old_user_id" UUID,

    CONSTRAINT "PhoneReleasePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTitle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" VARCHAR(50) NOT NULL,
    "sub_category" VARCHAR(50),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "JobTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "logo" VARCHAR(500),
    "industry_id" UUID,
    "size" VARCHAR(20),
    "location" VARCHAR(100),
    "contact_phone" VARCHAR(20),
    "website" VARCHAR(200),
    "description" TEXT,
    "founded_at" DATE,
    "verify_status" "CompanyVerifyStatus" NOT NULL DEFAULT 'PENDING',
    "avg_rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'HR',
    "status" "CompanyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "industry_id" UUID,
    "job_title_id" UUID,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_unit" "SalaryUnit" NOT NULL DEFAULT 'MONTH_K',
    "city" VARCHAR(50) NOT NULL,
    "job_type" "JobType" NOT NULL,
    "experience" "Experience",
    "education" VARCHAR(20),
    "tags" TEXT[],
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "closed_reason" "JobClosedReason",
    "audit_status" "JobAuditStatus" NOT NULL DEFAULT 'APPROVED',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "views" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobBoost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "boost" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "JobBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationBlacklist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID,
    "candidate_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reviewer_id" UUID NOT NULL,
    "reviewee_type" "ReviewType" NOT NULL,
    "company_id" UUID,
    "candidate_id" UUID,
    "conversation_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "reply" VARCHAR(500),
    "reply_status" "ReplyStatus" NOT NULL DEFAULT 'APPROVED',
    "reply_reviewed_by" UUID,
    "edited_at" TIMESTAMPTZ,
    "edit_count" SMALLINT NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "price_monthly" DECIMAL(10,2),
    "price_yearly" DECIMAL(10,2),
    "job_limit" INTEGER NOT NULL,
    "can_feature" BOOLEAN NOT NULL DEFAULT false,
    "can_view_contacts" BOOLEAN NOT NULL DEFAULT false,
    "duration_days" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_no" VARCHAR(64) NOT NULL,
    "company_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ,
    "note" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "handled_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "event_type" "UserEventType" NOT NULL,
    "weight" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "body" VARCHAR(500),
    "link" VARCHAR(300),
    "channel" "NotificationChannel" NOT NULL DEFAULT 'INAPP',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" UUID,
    "detail" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20),
    "user_id" UUID,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitiveWord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "word" VARCHAR(100) NOT NULL,
    "category" VARCHAR(30),
    "scope" "SensitiveWordScope" NOT NULL DEFAULT 'ALL',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensitiveWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "AnnouncementType" NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT,
    "image_url" VARCHAR(500),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "start_at" TIMESTAMPTZ,
    "end_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "site_name" VARCHAR(50) NOT NULL DEFAULT '职桥 JobBridge',
    "register_enabled" BOOLEAN NOT NULL DEFAULT true,
    "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "payment_enabled" BOOLEAN NOT NULL DEFAULT true,
    "audit_mode" "AuditMode" NOT NULL DEFAULT 'POST',
    "nearby_radius_km" INTEGER NOT NULL DEFAULT 50,
    "default_city" VARCHAR(50) NOT NULL DEFAULT '全国',
    "page_size" INTEGER NOT NULL DEFAULT 20,
    "chat_rate_limit_per_min" INTEGER NOT NULL DEFAULT 20,
    "sms_rate_limit_per_min" INTEGER NOT NULL DEFAULT 5,
    "token_ttl_min" INTEGER NOT NULL DEFAULT 30,
    "refresh_ttl_days" INTEGER NOT NULL DEFAULT 30,
    "upload_max_mb" INTEGER NOT NULL DEFAULT 10,
    "upload_allowed_types" VARCHAR(100) NOT NULL DEFAULT 'jpg,jpeg,png,pdf,doc,docx',
    "upload_driver" VARCHAR(20) NOT NULL DEFAULT 'local',
    "upload_base_url" VARCHAR(300),
    "rating_max" SMALLINT NOT NULL DEFAULT 5,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_msg" VARCHAR(200),
    "icp_no" VARCHAR(50),
    "contact_email" VARCHAR(100),
    "reply_review_review" BOOLEAN NOT NULL DEFAULT false,
    "notify_by_sms" BOOLEAN NOT NULL DEFAULT false,
    "queue_attempts" INTEGER NOT NULL DEFAULT 3,
    "queue_backoff_ms" INTEGER NOT NULL DEFAULT 1000,
    "queue_dlq_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(200) NOT NULL DEFAULT '职桥 JobBridge - 找工作，招人才',
    "description" VARCHAR(500),
    "keywords" VARCHAR(300),
    "sitemap_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SeoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "auto_enabled" BOOLEAN NOT NULL DEFAULT true,
    "schedule_cron" VARCHAR(50) NOT NULL DEFAULT '0 3 * * *',
    "backup_type" "BackupType" NOT NULL DEFAULT 'FULL',
    "storage_driver" VARCHAR(20),
    "encrypt" BOOLEAN NOT NULL DEFAULT false,
    "retention_count" INTEGER NOT NULL DEFAULT 14,
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BackupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbBackup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "DbBackupType" NOT NULL,
    "format" "BackupFormat" NOT NULL DEFAULT 'CUSTOM',
    "storage_driver" VARCHAR(20) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "status" "DbBackupStatus" NOT NULL DEFAULT 'RUNNING',
    "note" VARCHAR(200),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DbBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(30) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ,
    "published_by" UUID,
    "effective_from" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPolicyAgreement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "policy_key" VARCHAR(30) NOT NULL,
    "policy_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "agreed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(300),
    "source" "PolicySource" NOT NULL DEFAULT 'REGISTER',

    CONSTRAINT "UserPolicyAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "w_skill" DECIMAL(4,2) NOT NULL DEFAULT 4.0,
    "w_type" DECIMAL(4,2) NOT NULL DEFAULT 2.0,
    "w_city_located" DECIMAL(4,2) NOT NULL DEFAULT 6.0,
    "w_city_expected" DECIMAL(4,2) NOT NULL DEFAULT 2.0,
    "located_city_enabled" BOOLEAN NOT NULL DEFAULT true,
    "w_behavior" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "w_b_view" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "w_b_favorite" DECIMAL(4,2) NOT NULL DEFAULT 3.0,
    "w_b_chat" DECIMAL(4,2) NOT NULL DEFAULT 5.0,
    "w_hot" DECIMAL(4,2) NOT NULL DEFAULT 0.2,
    "freshness_halflife_days" INTEGER NOT NULL DEFAULT 14,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RecommendationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageView" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "session_id" VARCHAR(64) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "referer" VARCHAR(500),
    "user_agent" VARCHAR(300),
    "device" VARCHAR(20),
    "province" VARCHAR(30),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stat_date" DATE NOT NULL,
    "pv" INTEGER NOT NULL DEFAULT 0,
    "uv" INTEGER NOT NULL DEFAULT 0,
    "dau" INTEGER NOT NULL DEFAULT 0,
    "wau" INTEGER NOT NULL DEFAULT 0,
    "mau" INTEGER NOT NULL DEFAULT 0,
    "new_users" INTEGER NOT NULL DEFAULT 0,
    "new_companies" INTEGER NOT NULL DEFAULT 0,
    "new_jobs" INTEGER NOT NULL DEFAULT 0,
    "new_conversations" INTEGER NOT NULL DEFAULT 0,
    "new_reviews" INTEGER NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active_companies" INTEGER NOT NULL DEFAULT 0,
    "retention_d1" DECIMAL(5,4),
    "retention_d7" DECIMAL(5,4),
    "retention_d30" DECIMAL(5,4),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "PaymentChannel" NOT NULL,
    "merchant_id" VARCHAR(64) NOT NULL,
    "app_secret_enc" VARCHAR(600),
    "cert_serial" VARCHAR(64),
    "platform_cert_enc" TEXT,
    "gateway_url" VARCHAR(300),
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "province" VARCHAR(50),
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "coord_type" VARCHAR(10) NOT NULL DEFAULT 'GCJ02',
    "source" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "SmsProviderType" NOT NULL,
    "access_key" VARCHAR(200) NOT NULL,
    "secret_enc" VARCHAR(600),
    "sign_name" VARCHAR(50) NOT NULL,
    "template_code_login" VARCHAR(50),
    "template_code_notify" VARCHAR(50),
    "endpoint" VARCHAR(300),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SmsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "purpose" "SmsPurpose" NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "expire_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeekerPost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "expected_salary_min" INTEGER,
    "expected_salary_max" INTEGER,
    "city" VARCHAR(50) NOT NULL,
    "job_type" "JobType",
    "experience" "Experience",
    "education" VARCHAR(20),
    "skills" TEXT[],
    "description" TEXT,
    "show_phone" BOOLEAN NOT NULL DEFAULT true,
    "status" "SeekerPostStatus" NOT NULL DEFAULT 'OPEN',
    "closed_reason" "SeekerPostClosedReason",
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SeekerPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caller_id" UUID NOT NULL,
    "callee_id" UUID NOT NULL,
    "related_type" "CallLogType",
    "related_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_role_idx" ON "User"("status", "role");

-- CreateIndex
CREATE INDEX "User_city_idx" ON "User"("city");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneReleasePool_phone_key" ON "PhoneReleasePool"("phone");

-- CreateIndex
CREATE INDEX "PhoneReleasePool_phone_released_at_idx" ON "PhoneReleasePool"("phone", "released_at");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_code_key" ON "Industry"("code");

-- CreateIndex
CREATE INDEX "Industry_parent_id_idx" ON "Industry"("parent_id");

-- CreateIndex
CREATE INDEX "Industry_active_sort_idx" ON "Industry"("active", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "JobTitle_code_key" ON "JobTitle"("code");

-- CreateIndex
CREATE INDEX "JobTitle_category_sub_category_idx" ON "JobTitle"("category", "sub_category");

-- CreateIndex
CREATE INDEX "JobTitle_name_idx" ON "JobTitle" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "JobTitle_active_sort_idx" ON "JobTitle"("active", "sort");

-- CreateIndex
CREATE INDEX "Company_owner_id_idx" ON "Company"("owner_id");

-- CreateIndex
CREATE INDEX "Company_verify_status_idx" ON "Company"("verify_status");

-- CreateIndex
CREATE INDEX "Company_industry_id_idx" ON "Company"("industry_id");

-- CreateIndex
CREATE INDEX "CompanyMember_user_id_status_idx" ON "CompanyMember"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_company_id_user_id_key" ON "CompanyMember"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "Job_company_id_idx" ON "Job"("company_id");

-- CreateIndex
CREATE INDEX "Job_status_created_at_idx" ON "Job"("status", "created_at");

-- CreateIndex
CREATE INDEX "Job_city_idx" ON "Job"("city");

-- CreateIndex
CREATE INDEX "Job_industry_id_idx" ON "Job"("industry_id");

-- CreateIndex
CREATE INDEX "Job_job_title_id_idx" ON "Job"("job_title_id");

-- CreateIndex
CREATE INDEX "Job_title_idx" ON "Job" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_lat_lng_idx" ON "Job"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "JobBoost_job_id_key" ON "JobBoost"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationBlacklist_job_id_key" ON "RecommendationBlacklist"("job_id");

-- CreateIndex
CREATE INDEX "Conversation_company_id_last_message_at_idx" ON "Conversation"("company_id", "last_message_at");

-- CreateIndex
CREATE INDEX "Conversation_candidate_id_last_message_at_idx" ON "Conversation"("candidate_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_candidate_id_company_id_job_id_key" ON "Conversation"("candidate_id", "company_id", "job_id");

-- CreateIndex
CREATE INDEX "Message_conversation_id_created_at_idx" ON "Message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "Review_company_id_deleted_at_idx" ON "Review"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Review_candidate_id_deleted_at_idx" ON "Review"("candidate_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewer_id_conversation_id_key" ON "Review"("reviewer_id", "conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_user_id_job_id_key" ON "Favorite"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "Subscription_company_id_idx" ON "Subscription"("company_id");

-- CreateIndex
CREATE INDEX "Subscription_status_end_at_idx" ON "Subscription"("status", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_order_no_key" ON "Payment"("order_no");

-- CreateIndex
CREATE INDEX "Payment_company_id_idx" ON "Payment"("company_id");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "UserEvent_user_id_event_type_created_at_idx" ON "UserEvent"("user_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "Notification_user_id_read_at_idx" ON "Notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

-- CreateIndex
CREATE INDEX "AuditLog_admin_id_idx" ON "AuditLog"("admin_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "LoginLog_created_at_idx" ON "LoginLog"("created_at");

-- CreateIndex
CREATE INDEX "LoginLog_phone_idx" ON "LoginLog"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "SensitiveWord_word_key" ON "SensitiveWord"("word");

-- CreateIndex
CREATE INDEX "Announcement_type_active_sort_idx" ON "Announcement"("type", "active", "sort");

-- CreateIndex
CREATE INDEX "DbBackup_created_at_idx" ON "DbBackup"("created_at");

-- CreateIndex
CREATE INDEX "DbBackup_status_idx" ON "DbBackup"("status");

-- CreateIndex
CREATE INDEX "Policy_key_status_idx" ON "Policy"("key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_key_version_key" ON "Policy"("key", "version");

-- CreateIndex
CREATE INDEX "UserPolicyAgreement_user_id_policy_key_agreed_at_idx" ON "UserPolicyAgreement"("user_id", "policy_key", "agreed_at");

-- CreateIndex
CREATE INDEX "UserPolicyAgreement_policy_id_idx" ON "UserPolicyAgreement"("policy_id");

-- CreateIndex
CREATE INDEX "PageView_created_at_idx" ON "PageView"("created_at");

-- CreateIndex
CREATE INDEX "PageView_path_idx" ON "PageView"("path");

-- CreateIndex
CREATE INDEX "PageView_session_id_idx" ON "PageView"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_stat_date_key" ON "DailyStat"("stat_date");

-- CreateIndex
CREATE INDEX "DailyStat_stat_date_idx" ON "DailyStat"("stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConfig_channel_key" ON "PaymentConfig"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE INDEX "City_province_idx" ON "City"("province");

-- CreateIndex
CREATE UNIQUE INDEX "SmsConfig_provider_key" ON "SmsConfig"("provider");

-- CreateIndex
CREATE INDEX "SmsCode_phone_purpose_created_at_idx" ON "SmsCode"("phone", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "SeekerPost_city_idx" ON "SeekerPost"("city");

-- CreateIndex
CREATE INDEX "SeekerPost_status_created_at_idx" ON "SeekerPost"("status", "created_at");

-- CreateIndex
CREATE INDEX "SeekerPost_user_id_idx" ON "SeekerPost"("user_id");

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "JobTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBoost" ADD CONSTRAINT "JobBoost_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reply_reviewed_by_fkey" FOREIGN KEY ("reply_reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DbBackup" ADD CONSTRAINT "DbBackup_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPolicyAgreement" ADD CONSTRAINT "UserPolicyAgreement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPolicyAgreement" ADD CONSTRAINT "UserPolicyAgreement_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeekerPost" ADD CONSTRAINT "SeekerPost_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_callee_id_fkey" FOREIGN KEY ("callee_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
