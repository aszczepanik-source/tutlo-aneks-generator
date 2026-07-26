import { annexModules } from './src/annexes/catalog.js';

/**
 * Compatibility boundary between the existing UI router and annex modules.
 * Module metadata is deliberately read only from the registered manifest.
 */
export function getAnnexRoute(annexId, contract) {
  const annex = annexModules.get(String(annexId));
  if (!annex || annex.manifest.available !== true) return undefined;
  if (annex.manifest.id === '25' && contract && !(contract.contractType === 'flexible'
    && contract.paymentType === 'internal' && contract.installmentCount === 24)) return undefined;
  if (annex.manifest.id === '43'
    && !String(contract?.rawText || '').toLowerCase().includes(annex.manifest.availabilityText)) return undefined;

  return Object.freeze({
    number: annex.manifest.id,
    name: annex.manifest.label,
    available: annex.manifest.available,
    template: annex.manifest.template,
    requiredPlaceholders: Object.freeze([...annex.manifest.requiredFields]),
    status: annex.manifest.status,
    blockingReason: annex.manifest.blockingReason,
    createGenerationPlan: annex.createGenerationPlan,
    prepareAnnex25: annex.prepareAnnex25
  });
}

export function getAvailableAnnexRoutes(contract) {
  return Object.freeze(
    [...annexModules.keys()].map(id => getAnnexRoute(id, contract)).filter(Boolean)
  );
}
