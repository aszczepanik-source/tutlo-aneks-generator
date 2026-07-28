// Stabilization registry: legacy annex modules remain in the repository but are
// intentionally not imported by the automatic recognition flow.
import * as annex26 from './26/index.js';
import * as annex11 from './11/index.js';

export const annexModules = new Map([
  [annex11.manifest.id, annex11],
  [annex26.manifest.id, annex26]
]);

export function getAnnexModule(annexId) {
  return annexModules.get(String(annexId));
}
