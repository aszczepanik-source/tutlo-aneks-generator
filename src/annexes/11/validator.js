import manifest from './manifest.json' with { type: 'json' };
import { createRequiredFieldsValidator } from '../shared/validation.js';

export const validate = createRequiredFieldsValidator(manifest.requiredFields);
