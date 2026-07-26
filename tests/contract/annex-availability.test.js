import assert from 'node:assert/strict';
import test from 'node:test';
import { ANNEX_STATUSES, getAvailableAnnexCards } from '../../src/annexes/availability.js';
import { prepareAnnex26 } from '../../src/annexes/26/index.js';

const externalIds = contract => getAvailableAnnexCards(contract)
  .filter(({ status }) => status === 'external').map(({ no }) => no);

const assertCards = (contract, expectedIds, expectedStatuses) => {
  const cards = getAvailableAnnexCards(contract);
  assert.deepEqual(cards.map(({ no }) => no), expectedIds);
  assert.deepEqual(cards.map(({ status }) => status), expectedStatuses);
  assert.equal(cards.length, expectedIds.length);
};

test('flexible + credit udostępnia wyłącznie zachowane zielone i wymagane karty', () => {
  const contract = { contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' };
  assertCards(contract,
    ['26', 'wydluzenie-dostepu', '20-lekcji-gratis', 'tutlo-premium', '30', '30a', '10', '35'],
    ['tutlo', 'external', 'external', 'external', 'planned', 'planned', 'planned', 'planned']);
  assert.deepEqual(externalIds(contract), ['wydluzenie-dostepu', '20-lekcji-gratis', 'tutlo-premium']);
});

const INTERNAL_IDS = [
  'wydluzenie-dostepu', 'rozlozenie-platnosci', 'tutlo-premium', 'lektorzy-pl',
  '45', '35', '48', '29', '29a'
];
const INTERNAL_STATUSES = [
  'external', 'external', 'external', 'external',
  'planned', 'planned', 'planned', 'planned', 'planned'
];

for (const paymentVariant of ['internal_24', 'internal_2', 'internal_13', 'internal_4']) {
  test(`limit + ${paymentVariant} korzysta z jednej ścisłej listy`, () => {
    const contract = {
      contractType: 'limit', paymentType: 'internal', paymentVariant, hasPolishLecturers: false
    };
    assertCards(contract, INTERNAL_IDS, INTERNAL_STATUSES);
    assert.deepEqual(externalIds(contract), [
      'wydluzenie-dostepu', 'rozlozenie-platnosci', 'tutlo-premium', 'lektorzy-pl'
    ]);
  });
}

test('limit + credit udostępnia wyłącznie zachowane zielone i wymagane czerwone karty', () => {
  const contract = {
    contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit', hasPolishLecturers: false
  };
  assertCards(contract,
    ['wydluzenie-dostepu', 'tutlo-premium', 'lektorzy-pl', '45', '35', '48', '30', '30a'],
    ['external', 'external', 'external', 'planned', 'planned', 'planned', 'planned', 'planned']);
  assert.deepEqual(externalIds(contract), ['wydluzenie-dostepu', 'tutlo-premium', 'lektorzy-pl']);
});

test('warunkowa zielona karta lektorów zachowuje dotychczasową dostępność', () => {
  const contract = { contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit' };
  assert.equal(getAvailableAnnexCards(contract).some(({ no }) => no === 'lektorzy-pl'), false);
  assert.equal(getAvailableAnnexCards({ ...contract, hasPolishLecturers: true })
    .some(({ no }) => no === 'lektorzy-pl'), false);
  assert.equal(getAvailableAnnexCards({ ...contract, hasPolishLecturers: false })
    .some(({ no }) => no === 'lektorzy-pl'), true);
});

test('nazwy, kolory i statusy kart odpowiadają centralnej konfiguracji', () => {
  assert.deepEqual(ANNEX_STATUSES, {
    tutlo: { label: 'Generator Tutlo', className: 'generator-tutlo' },
    external: { label: 'Aneks w Team Tutlo', className: 'external-generator' },
    planned: { label: 'W przygotowaniu', className: 'in-preparation' }
  });
  const flexible = getAvailableAnnexCards({ contractType: 'flexible', paymentType: 'credit' });
  assert.equal(flexible.find(({ no }) => no === '26').name, 'Aneks 26 — Zmniejszenie rat kredytowych');
  assert.equal(flexible.find(({ no }) => no === '30').name, 'Aneks 30 — Spłata jednej raty kredytowej');
  const internal = getAvailableAnnexCards({
    contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_24'
  });
  assert.equal(internal.find(({ no }) => no === '45').name,
    'Aneks 45 — Kurs z limitem tygodniowym, raty wewnętrzne');
});

test('nieobsługiwane kombinacje nie dostają ogólnej listy kart', () => {
  assert.deepEqual(getAvailableAnnexCards({ contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_2' }), []);
  assert.deepEqual(getAvailableAnnexCards(undefined), []);
});

test('działający generator aneksu 26 i jego prepared.values pozostają bez zmian', () => {
  const currentContract = {
    contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit', agreementNumber: 'T/26',
    customerType: 'person', customerName: 'Jan Kowalski', address: 'Testowa 1',
    personalId: '90010112345', agreementDate: '2025-01-02', coursePriceCents: 1125000,
    lessonCount: 450, monthlyLessonLimit: 24, teacherVariant: 'polish_english_native',
    internalPaymentAccount: null, installmentPlan: null
  };
  const before = structuredClone(currentContract);
  const prepared = prepareAnnex26(currentContract, {
    newInstallment: '400', bank: 'Inbank', bankAccount: '12345678901234567890123456'
  }, new Date('2025-03-01T12:00:00Z'));
  assert.ok(prepared.values);
  assert.deepEqual(currentContract, before);
});
