-- CreateTable
CREATE TABLE "department_membership_history" (
    "id" UUID NOT NULL,
    "memberId" TEXT NOT NULL,
    "fromDepartmentId" UUID,
    "toDepartmentId" UUID NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_membership_history_memberId_changedAt_idx" ON "department_membership_history"("memberId", "changedAt");

-- CreateIndex
CREATE INDEX "department_membership_history_fromDepartmentId_idx" ON "department_membership_history"("fromDepartmentId");

-- CreateIndex
CREATE INDEX "department_membership_history_toDepartmentId_idx" ON "department_membership_history"("toDepartmentId");

-- CreateIndex
CREATE INDEX "department_membership_history_changedById_idx" ON "department_membership_history"("changedById");

-- AddForeignKey
ALTER TABLE "department_membership_history" ADD CONSTRAINT "department_membership_history_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_membership_history" ADD CONSTRAINT "department_membership_history_fromDepartmentId_fkey" FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_membership_history" ADD CONSTRAINT "department_membership_history_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_membership_history" ADD CONSTRAINT "department_membership_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
