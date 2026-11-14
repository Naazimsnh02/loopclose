import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseProgrammeYaml, type ProgrammeDefinition } from '../programme.js';
import type { Actor, Owner } from '../types.js';

const here = dirname(fileURLToPath(import.meta.url));
const programmesDir = resolve(here, '../../../../config/programmes');

export function loadProgramme(file: 'colorectal-fit' | 'breast-birads'): ProgrammeDefinition {
  return parseProgrammeYaml(readFileSync(resolve(programmesDir, `${file}.yaml`), 'utf8'));
}

export const coordinator: Owner = { id: 'u-coord', role: 'coordinator', organizationId: 'org-adphc' };
export const phc: Owner = { id: 'u-phc', role: 'phc_clinician', organizationId: 'org-phc' };
export const specialist: Owner = { id: 'u-gi', role: 'specialist', organizationId: 'org-hosp' };
export const scheduler: Owner = { id: 'u-sched', role: 'specialist_scheduler', organizationId: 'org-hosp' };
export const treating: Owner = { id: 'u-onc', role: 'treating_clinician', organizationId: 'org-hosp' };

export const humanCoordinator: Actor = { kind: 'human', id: 'u-coord', role: 'coordinator' };
export const humanPhc: Actor = { kind: 'human', id: 'u-phc', role: 'phc_clinician' };
export const humanSpecialist: Actor = { kind: 'human', id: 'u-gi', role: 'specialist' };
export const systemActor: Actor = { kind: 'system', id: 'intake' };
export const aiNavigator: Actor = { kind: 'ai', id: 'navigator' };

export const T0 = new Date('2026-11-02T08:00:00.000Z'); // a Monday
