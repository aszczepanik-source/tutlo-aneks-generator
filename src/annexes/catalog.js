// Stabilization registry: legacy annex modules remain in the repository but are
// intentionally not imported by the automatic recognition flow.
import * as annex26 from './26/index.js';
import * as annex27 from './27/index.js';
import * as annex11 from './11/index.js';
import * as annex29 from './29/index.js';
import * as annex29a from './29a/index.js';
import * as annex43 from './43/index.js';
import * as annex45 from './45/index.js';
import * as annex45c from './45c/index.js';

export const annexModules = new Map([
  [annex11.manifest.id, annex11],
  [annex26.manifest.id, annex26],
  [annex27.manifest.id, annex27],
  [annex29.manifest.id, annex29],
  [annex29a.manifest.id, annex29a],
  [annex43.manifest.id, annex43],
  [annex45.manifest.id, annex45],
  [annex45c.manifest.id, annex45c]
]);

export function getAnnexModule(annexId) {
  return annexModules.get(String(annexId));
}
