/** Code systems and identifier namespaces used across LoopClose FHIR resources. */
export const LOOPCLOSE_SYSTEM = 'https://loopclose.health/fhir';

export const Systems = {
  caseId: `${LOOPCLOSE_SYSTEM}/case-id`,
  resultId: `${LOOPCLOSE_SYSTEM}/result-id`,
  taskCode: `${LOOPCLOSE_SYSTEM}/task-code`,
  caseState: `${LOOPCLOSE_SYSTEM}/case-state`,
  urgencyTier: `${LOOPCLOSE_SYSTEM}/urgency-tier`,
  programme: `${LOOPCLOSE_SYSTEM}/programme`,
  evidenceType: `${LOOPCLOSE_SYSTEM}/evidence-type`,
  loinc: 'http://loinc.org',
  snomed: 'http://snomed.info/sct',
  v3ActCode: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  diagnosticServiceSection: 'http://terminology.hl7.org/CodeSystem/v2-0074',
} as const;

/** LOINC codes for the two prototype programmes. */
export const Loinc = {
  fitResult: '29771-3', // Hemoglobin.gastrointestinal [Presence] in Stool by Immunoassay
  mammogramBirads: '72137-3', // BI-RADS assessment category (screening mammogram)
} as const;

/**
 * Task.businessStatus values aligned to the 360X / BSeR referral state harmonisation.
 * ServiceRequest.status is controlled by the initiator; Task.status by the recipient/owner.
 */
export const ReferralBusinessStatus = {
  offered: 'offered',
  accepted: 'accepted',
  declined: 'declined',
  redirected: 'redirected',
  inProgress: 'in-progress',
  completed: 'completed',
  cancelled: 'cancelled',
} as const;
