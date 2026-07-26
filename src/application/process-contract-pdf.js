import { ContractParseError, parseCurrentContract } from '../domain/contract-extraction.js';
import { validateCurrentContract } from '../domain/current-contract-validation.js';

export const CONTRACT_PROCESSING_MESSAGES = Object.freeze({
  extraction: 'Nie udało się odczytać tekstu z PDF.',
  recognition: 'Odczytano PDF, ale nie rozpoznano rodzaju umowy.',
  technical: 'Wystąpił błąd techniczny podczas analizy umowy.'
});

export class ContractProcessingError extends Error {
  constructor(stage, message, options = {}) {
    super(message, options);
    this.name = 'ContractProcessingError';
    this.stage = stage;
    this.extractedText = options.extractedText;
    this.issues = options.issues || [];
  }
}

function textFromExtraction(result) {
  if (typeof result === 'string') return result;
  if (result && typeof result.text === 'string') return result.text;
  return result;
}

/** Extracts once, parses once, validates, then returns the only currentContract DTO. */
export async function processContractPdf(file, dependencies = {}) {
  const extractText = dependencies.extractText;
  const parse = dependencies.parseCurrentContract || parseCurrentContract;
  const validate = dependencies.validateCurrentContract || validateCurrentContract;
  let stage = 'extraction';
  let extractedText;

  try {
    const extractionResult = await extractText(file);
    extractedText = textFromExtraction(extractionResult);

    stage = 'parsing';
    const contract = parse(extractedText);
    if (!contract.contractType || !contract.paymentType) {
      throw new ContractProcessingError('recognition', CONTRACT_PROCESSING_MESSAGES.recognition, { extractedText });
    }

    stage = 'validation';
    const validation = validate(contract);
    if (!validation.valid) {
      throw new ContractProcessingError(
        'validation',
        `Odczytano umowę, ale brakuje wymaganych danych: ${validation.issues.join(' ')}`,
        { extractedText, issues: validation.issues }
      );
    }
    return contract;
  } catch (error) {
    if (error instanceof ContractProcessingError) throw error;
    if (error instanceof ContractParseError && error.code === 'EMPTY_PDF_TEXT') {
      throw new ContractProcessingError('extraction', CONTRACT_PROCESSING_MESSAGES.extraction, { extractedText, cause: error });
    }
    const message = stage === 'extraction' ? CONTRACT_PROCESSING_MESSAGES.extraction : CONTRACT_PROCESSING_MESSAGES.technical;
    throw new ContractProcessingError(stage, message, { extractedText, cause: error });
  }
}
