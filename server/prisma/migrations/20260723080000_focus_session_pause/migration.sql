-- AlterTable
ALTER TABLE "FocusSession" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedMinutesTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remainingMsAtPause" INTEGER;

