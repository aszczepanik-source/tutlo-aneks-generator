import manifest from './manifest.json' with { type: 'json' };
import { createGenerationPlanFactory } from '../shared/generator.js';
import { validate } from './validator.js';

export const createGenerationPlan = createGenerationPlanFactory({
  annexId: manifest.id,
  templateUrl: new URL(manifest.template, import.meta.url),
  validate
});
