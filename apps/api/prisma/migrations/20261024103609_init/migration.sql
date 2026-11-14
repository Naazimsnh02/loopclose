-- CreateEnum
CREATE TYPE "OrgKind" AS ENUM ('PROGRAMME_AUTHORITY', 'LAB', 'PRIMARY_CARE', 'SPECIALIST', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('human', 'system', 'ai');

-- CreateEnum
CREATE TYPE "UrgencyTier" AS ENUM ('routine', 'priority', 'urgent');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('web_chat', 'whatsapp', 'sms', 'email', 'phone');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('offered', 'accepted', 'declined', 'redirected', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('booked', 'attended', 'no_show', 'cancelled');

-- CreateEnum
CREATE TYPE "ProposalKind" AS ENUM ('handoff_summary', 'risk_assessment', 'suggested_action', 'patient_message', 'acknowledgement');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OrgKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "fhirId" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "sex" TEXT NOT NULL,
    "nationality" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "phone" TEXT,
    "email" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "transportBarrier" BOOLEAN NOT NULL DEFAULT false,
    "priorNoShows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "fhirId" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningResult" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "performerOrgId" TEXT NOT NULL,
    "loincCode" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "actionable" BOOLEAN NOT NULL,
    "flags" TEXT[],
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fhirReportId" TEXT,
    "rawSource" JSONB,

    CONSTRAINT "ScreeningResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "tier" "UrgencyTier" NOT NULL,
    "ownerId" TEXT,
    "ownerRole" TEXT,
    "ownerOrgId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredStateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDeadlineAt" TIMESTAMP(3),
    "slaWarnAt" TIMESTAMP(3),
    "stalled" BOOLEAN NOT NULL DEFAULT false,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "referralDeclineCount" INTEGER NOT NULL DEFAULT 0,
    "riskTier" TEXT,
    "riskScore" DOUBLE PRECISION,
    "riskReasons" JSONB,
    "closedAt" TIMESTAMP(3),
    "fhirTaskId" TEXT,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "actorKind" "ActorKind" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fhirProvenanceId" TEXT,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAttempt" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "outcome" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "initiatorOrgId" TEXT NOT NULL,
    "recipientOrgId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'offered',
    "procedureCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "declineReason" TEXT,
    "continuityPacket" JSONB,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "fhirServiceRequestId" TEXT,
    "fhirTaskId" TEXT,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consult" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "responderId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "thread" JSONB NOT NULL,

    CONSTRAINT "Consult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" "Channel" NOT NULL,
    "locale" TEXT NOT NULL,
    "templateId" TEXT,
    "text" TEXT NOT NULL,
    "graderVerdict" JSONB,
    "delivery" "DeliveryStatus" NOT NULL DEFAULT 'queued',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fhirCommunicationId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "providerOrgId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'booked',
    "procedure" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fhirId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProposal" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "ProposalKind" NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceRefs" JSONB,
    "status" "ProposalStatus" NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditLogId" TEXT,

    CONSTRAINT "AIProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetOrgId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "reason" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "status" "EscalationStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorKind" "ActorKind" NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "patientId" TEXT,
    "purpose" TEXT,
    "aiFeature" TEXT,
    "aiModel" TEXT,
    "promptHash" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "outcome" TEXT,
    "metadata" JSONB,
    "fhirAuditEventId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFeatureFlag" (
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AIFeatureFlag_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_fhirId_key" ON "Patient"("fhirId");

-- CreateIndex
CREATE INDEX "ConsentRecord_patientId_scope_idx" ON "ConsentRecord"("patientId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningResult_externalId_key" ON "ScreeningResult"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Case_resultId_key" ON "Case"("resultId");

-- CreateIndex
CREATE INDEX "Case_state_idx" ON "Case"("state");

-- CreateIndex
CREATE INDEX "Case_ownerId_idx" ON "Case"("ownerId");

-- CreateIndex
CREATE INDEX "Case_slaDeadlineAt_idx" ON "Case"("slaDeadlineAt");

-- CreateIndex
CREATE INDEX "Case_programmeId_state_idx" ON "Case"("programmeId", "state");

-- CreateIndex
CREATE INDEX "CaseEvent_type_idx" ON "CaseEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CaseEvent_caseId_sequence_key" ON "CaseEvent"("caseId", "sequence");

-- CreateIndex
CREATE INDEX "Message_caseId_createdAt_idx" ON "Message"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIProposal_status_kind_idx" ON "AIProposal"("status", "kind");

-- CreateIndex
CREATE INDEX "Escalation_status_targetRole_idx" ON "Escalation"("status", "targetRole");

-- CreateIndex
CREATE INDEX "AuditLog_patientId_at_idx" ON "AuditLog"("patientId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_aiFeature_at_idx" ON "AuditLog"("aiFeature", "at");

-- CreateIndex
CREATE INDEX "Outbox_processedAt_idx" ON "Outbox"("processedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResult" ADD CONSTRAINT "ScreeningResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResult" ADD CONSTRAINT "ScreeningResult_performerOrgId_fkey" FOREIGN KEY ("performerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ScreeningResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_initiatorOrgId_fkey" FOREIGN KEY ("initiatorOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_recipientOrgId_fkey" FOREIGN KEY ("recipientOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consult" ADD CONSTRAINT "Consult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProposal" ADD CONSTRAINT "AIProposal_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
