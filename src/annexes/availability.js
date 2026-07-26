export const ANNEX_STATUSES = Object.freeze({
  tutlo: Object.freeze({ label: 'Generator Tutlo', className: 'generator-tutlo' }),
  external: Object.freeze({ label: 'Aneks w Team Tutlo', className: 'external-generator' }),
  planned: Object.freeze({ label: 'W przygotowaniu', className: 'in-preparation' })
});

const card = (no, name, status, options = {}) => Object.freeze({ no, name, status, ...options });

const SHARED_EXTERNAL_CARDS = Object.freeze([
  card('wydluzenie-dostepu', 'Wydłużenie dostępu', 'external', {
    marker: '↗', desc: 'Dostępny dla każdej umowy.'
  }),
  card('tutlo-premium', 'Aneks Tutlo Premium', 'external', {
    marker: 'P', desc: 'Dostępny dla każdej umowy.'
  })
]);

const POLISH_LECTURERS_CARD = card('lektorzy-pl', 'Rozszerzenie pakietu lektorów', 'external', {
  marker: 'PL',
  desc: 'Dostępny, gdy umowa nie obejmuje lektorów PL.',
  when: contract => contract?.hasPolishLecturers === false
});

const FLEXIBLE_CREDIT_CARDS = Object.freeze([
  card('26', 'Aneks 26 — Zmniejszenie rat kredytowych', 'tutlo'),
  SHARED_EXTERNAL_CARDS[0],
  card('20-lekcji-gratis', '20 lekcji gratis', 'external', {
    marker: '20', desc: 'Tylko dla umów elastycznych.'
  }),
  SHARED_EXTERNAL_CARDS[1],
  card('30', 'Aneks 30 — Spłata jednej raty kredytowej', 'planned'),
  card('30a', 'Aneks 30a — Spłata dwóch rat kredytowych', 'planned'),
  card('10', 'Aneks 10 — Zmiana formy płatności', 'planned'),
  card('35', 'Aneks 35 — Grupa rodzinna', 'planned')
]);

const LIMIT_INTERNAL_CARDS = Object.freeze([
  SHARED_EXTERNAL_CARDS[0],
  card('rozlozenie-platnosci', 'Rozłożenie płatności', 'external', {
    marker: 'R', desc: 'Tylko dla rat wewnętrznych.'
  }),
  SHARED_EXTERNAL_CARDS[1],
  POLISH_LECTURERS_CARD,
  card('45', 'Aneks 45 — Kurs z limitem tygodniowym, raty wewnętrzne', 'planned'),
  card('35', 'Aneks 35 — Grupa rodzinna', 'planned'),
  card('48', 'Aneks 48 — Zdjęcie limitu', 'planned'),
  card('29', 'Aneks 29 — Spłata jednej raty wewnętrznej', 'planned'),
  card('29a', 'Aneks 29a — Spłata dwóch rat wewnętrznych', 'planned')
]);

const LIMIT_CREDIT_CARDS = Object.freeze([
  ...SHARED_EXTERNAL_CARDS,
  POLISH_LECTURERS_CARD,
  card('45', 'Aneks 45 — Kurs z limitem tygodniowym, kredyt', 'planned'),
  card('35', 'Aneks 35 — Grupa rodzinna', 'planned'),
  card('48', 'Aneks 48 — Zdjęcie limitu', 'planned'),
  card('30', 'Aneks 30 — Spłata jednej raty kredytowej', 'planned'),
  card('30a', 'Aneks 30a — Spłata dwóch rat kredytowych', 'planned')
]);

const INTERNAL_VARIANTS = new Set(['internal_24', 'internal_2', 'internal_13', 'internal_4']);

/** Central, deterministic availability rule consumed by both card views. */
export function getAvailableAnnexCards(currentContract) {
  const { contractType, paymentType, paymentVariant } = currentContract ?? {};
  let configuredCards = [];

  if (contractType === 'flexible' && paymentType === 'credit') {
    configuredCards = FLEXIBLE_CREDIT_CARDS;
  } else if (contractType === 'limit' && paymentType === 'internal'
    && INTERNAL_VARIANTS.has(paymentVariant)) {
    configuredCards = LIMIT_INTERNAL_CARDS;
  } else if (contractType === 'limit' && paymentType === 'credit') {
    configuredCards = LIMIT_CREDIT_CARDS;
  }

  return configuredCards.filter(item => !item.when || item.when(currentContract));
}
