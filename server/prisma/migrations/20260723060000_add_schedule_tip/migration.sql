-- CreateTable
CREATE TABLE "ScheduleTip" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "actions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleTip_pkey" PRIMARY KEY ("id")
);

