import manifest from './manifest.json' with { type: 'json' };
import { createGenerationPlanFactory } from '../shared/generator.js';
import { createRequiredFieldsValidator } from '../shared/validation.js';

// Adapter katalogu; nie jest częścią publicznego API modułu aneksu 26.
export const createGenerationPlan = createGenerationPlanFactory({
  annexId: manifest.id,
  templateUrl: new URL(manifest.template, import.meta.url),
  validate: createRequiredFieldsValidator(manifest.requiredFields)
});
