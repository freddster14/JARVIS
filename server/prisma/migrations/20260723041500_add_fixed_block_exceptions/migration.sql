-- CreateTable
CREATE TABLE "FixedBlockException" (
    "id" TEXT NOT NULL,
    "fixedBlockId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedBlockException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FixedBlockException_fixedBlockId_date_key" ON "FixedBlockException"("fixedBlockId", "date");

-- AddForeignKey
ALTER TABLE "FixedBlockException" ADD CONSTRAINT "FixedBlockException_fixedBlockId_fkey" FOREIGN KEY ("fixedBlockId") REFERENCES "FixedBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

