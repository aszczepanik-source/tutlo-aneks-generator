export const ANNEX_STATUSES = Object.freeze({
  tutlo: Object.freeze({ label: 'Generator Tutlo', className: 'generator-tutlo' }),
  external: Object.freeze({ label: 'Aneks w Team Tutlo', className: 'external-generator' }),
  planned: Object.freeze({ label: 'W przygotowaniu', className: 'in-preparation' })
});

const card = (no, name, status, options = {}) => Object.freeze({ no, name, status, ...options });

const EXTEND_ACCESS = card('wydluzenie-dostepu', 'Wydłużenie dostępu', 'external', {
  marker: '↗', desc: 'Dostępny dla każdej umowy.'
});
const EXTRA_LESSONS = card('20-lekcji-gratis', '20 dodatkowych lekcji', 'external', {
  marker: '20', desc: 'Aneks dostępny w Team Tutlo.'
});
const SPLIT_PAYMENT = card('rozlozenie-platnosci', 'Rozłożenie płatności', 'external', {
  marker: 'R', desc: 'Tylko dla rat wewnętrznych.'
});
const TUTLO_PREMIUM = card('tutlo-premium', 'Aneks Tutlo Premium', 'external', {
  marker: 'P', desc: 'Dostępny dla każdej umowy.'
});
const POLISH_LECTURERS = card('lektorzy-pl', 'Rozszerzenie pakietu lektorów', 'external', {
  marker: 'PL', desc: 'Aneks dostępny w Team Tutlo.'
});
const PAID_FAMILY_GROUP = card('43', 'Aneks 43 — Grupa rodzinna za dodatkową opłatą', 'planned');

const FLEXIBLE_INTERNAL_EXTERNAL = Object.freeze([
  EXTEND_ACCESS, EXTRA_LESSONS, SPLIT_PAYMENT, TUTLO_PREMIUM
]);
const FLEXIBLE_INTERNAL_PLANNED = Object.freeze([
  card('11', 'Aneks 11 — Zawieszenie dostępu', 'planned'),
  card('29', 'Aneks 29 — Spłata jednej raty wewnętrznej', 'planned'),
  card('29a', 'Aneks 29a — Spłata dwóch rat wewnętrznych', 'planned'),
  card('45', 'Aneks 45 — Kurs z limitem tygodniowym, raty wewnętrzne', 'planned')
]);
const FLEXIBLE_CREDIT = Object.freeze([
  card('26', 'Aneks 26 — Zmniejszenie rat kredytowych', 'tutlo'),
  card('27', 'Aneks 27 — Zmiana formy płatności ze zmniejszeniem rat', 'tutlo'),
  EXTEND_ACCESS,
  EXTRA_LESSONS,
  TUTLO_PREMIUM,
  card('30', 'Aneks 30 — Spłata jednej raty kredytowej', 'planned'),
  card('30a', 'Aneks 30a — Spłata dwóch rat kredytowych', 'planned'),
  card('10', 'Aneks 10 — Zmiana formy płatności', 'planned'),
  card('35', 'Aneks 35 — Grupa rodzinna', 'planned')
]);
const LIMIT_INTERNAL = Object.freeze([
  EXTEND_ACCESS, EXTRA_LESSONS, SPLIT_PAYMENT, TUTLO_PREMIUM, POLISH_LECTURERS,
  card('45', 'Aneks 45 — Kurs z limitem tygodniowym, raty wewnętrzne', 'planned'),
  card('35', 'Aneks 35 — Grupa rodzinna', 'planned'),
  card('48', 'Aneks 48 — Zdjęcie limitu', 'planned'),
  card('29', 'Aneks 29 — Spłata jednej raty wewnętrznej', 'planned'),
  card('29a', 'Aneks 29a — Spłata dwóch rat wewnętrznych', 'planned')
]);
const LIMIT_CREDIT = Object.freeze([
  EXTEND_ACCESS, EXTRA_LESSONS, TUTLO_PREMIUM, POLISH_LECTURERS,
  card('45', 'Aneks 45 — Kurs z limitem tygodniowym, kredyt', 'planned'),
  card('35', 'Aneks 35 — Grupa rodzinna', 'planned'),
  card('48', 'Aneks 48 — Zdjęcie limitu', 'planned'),
  card('30', 'Aneks 30 — Spłata jednej raty kredytowej', 'planned'),
  card('30a', 'Aneks 30a — Spłata dwóch rat kredytowych', 'planned')
]);

const INTERNAL_VARIANTS = new Set(['internal_24', 'internal_2', 'internal_13', 'internal_4']);

/**
 * Central card availability matrix. It intentionally reads only the three
 * classification fields produced by the contract parser.
 */
export function getAvailableAnnexCards(currentContract) {
  const { contractType, paymentType, paymentVariant, familyGroupVariant } = currentContract ?? {};
  const familyGroupCards = familyGroupVariant === 'paid' ? [PAID_FAMILY_GROUP] : [];

  if (contractType === 'flexible' && paymentType === 'internal'
      && INTERNAL_VARIANTS.has(paymentVariant)) {
    return paymentVariant === 'internal_24'
      ? [card('25', 'Aneks 25 — Zmniejszenie rat wewnętrznych', 'tutlo'),
          ...FLEXIBLE_INTERNAL_EXTERNAL,
          ...FLEXIBLE_INTERNAL_PLANNED.map(item => ['11', '29', '29a'].includes(item.no)
            ? card(item.no, item.name, 'tutlo') : item), ...familyGroupCards]
      : [...FLEXIBLE_INTERNAL_EXTERNAL, ...FLEXIBLE_INTERNAL_PLANNED, ...familyGroupCards];
  }
  if (contractType === 'flexible' && paymentType === 'credit' && paymentVariant === 'credit') {
    return [...FLEXIBLE_CREDIT, ...familyGroupCards];
  }
  if (contractType === 'limit' && paymentType === 'internal'
      && INTERNAL_VARIANTS.has(paymentVariant)) {
    return [...LIMIT_INTERNAL, ...familyGroupCards];
  }
  if (contractType === 'limit' && paymentType === 'credit' && paymentVariant === 'credit') {
    return [...LIMIT_CREDIT, ...familyGroupCards];
  }
  return [];
}
