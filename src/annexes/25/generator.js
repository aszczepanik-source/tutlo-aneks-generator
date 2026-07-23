import manifest from './manifest.json' with { type: 'json' };
import { createGenerationPlanFactory } from '../shared/generator.js';
import { validate } from './validator.js';

export const createGenerationPlan = createGenerationPlanFactory({
  annexId: manifest.id,
  templateUrl: new URL('./template.docx', import.meta.url),
  validate
});
