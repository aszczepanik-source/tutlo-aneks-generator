import * as annex11 from './11/index.js';
import * as annex25 from './25/index.js';
import * as annex26 from './26/index.js';
import { createGenerationPlan as createAnnex26GenerationPlan } from './26/legacy-plan.js';
import * as annex29 from './29/index.js';
import * as annex29a from './29a/index.js';

export const annexModules = new Map([
  [annex11.manifest.id, annex11],
  [annex25.manifest.id, annex25],
  [annex26.manifest.id, { ...annex26, createGenerationPlan: createAnnex26GenerationPlan }],
  [annex29.manifest.id, annex29],
  [annex29a.manifest.id, annex29a]
]);

export function getAnnexModule(annexId) {
  return annexModules.get(annexId);
}
