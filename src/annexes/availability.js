import { isAnnex43Available } from './43/availability.js';

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
const PAID_FAMILY_GROUP = card('43', '43 – Grupa Rodzinna', 'tutlo', {
  desc: 'Dodanie możliwości korzystania z kursu przez maksymalnie 2 dodatkowych użytkowników bez dodatkowej opłaty.'
});
const ANNEX_45 = card('45', '45 – Zmiana raty i wprowadzenie limitu tygodniowego', 'tutlo', {
  desc: 'Zmiana wysokości raty oraz wprowadzenie tygodniowego limitu lekcji.'
});
const ANNEX_48 = card('48', '48 – Zdjęcie limitu', 'tutlo', {
  desc: 'Zniesienie miesięcznego limitu wykorzystania lekcji i udostępnienie pozostałej puli bez limitu miesięcznego.'
});

const FLEXIBLE_INTERNAL_EXTERNAL = Object.freeze([
  EXTEND_ACCESS, EXTRA_LESSONS, SPLIT_PAYMENT, TUTLO_PREMIUM
]);
const FLEXIBLE_INTERNAL_PLANNED = Object.freeze([
  card('11', 'Aneks 11 — Zawieszenie dostępu', 'planned'),
  card('29', 'Aneks 29 — Spłata jednej raty wewnętrznej', 'planned'),
  card('29a', 'Aneks 29a — Spłata dwóch rat wewnętrznych', 'planned')
]);
const FLEXIBLE_CREDIT = Object.freeze([
  card('26', 'Aneks 26 — Zmniejszenie rat kredytowych', 'tutlo'),
  card('27', 'Aneks 27 — Zmiana formy płatności ze zmniejszeniem rat', 'tutlo'),
  EXTEND_ACCESS,
  EXTRA_LESSONS,
  TUTLO_PREMIUM,
  card('30', 'Aneks 30 — Spłata jednej raty kredytowej', 'planned'),
  card('30a', 'Aneks 30a — Spłata dwóch rat kredytowych', 'planned'),
  card('10', 'Aneks 10 — Zmiana formy płatności', 'planned')
]);
const LIMIT_INTERNAL = Object.freeze([
  EXTEND_ACCESS, EXTRA_LESSONS, SPLIT_PAYMENT, TUTLO_PREMIUM, POLISH_LECTURERS,
  ANNEX_48,
  card('29', 'Aneks 29 — Spłata jednej raty wewnętrznej', 'planned'),
  card('29a', 'Aneks 29a — Spłata dwóch rat wewnętrznych', 'planned')
]);
const ANNEX_45C = card('45c', '45C – Zmiana raty i limitu tygodniowego', 'tutlo', {
  desc: 'Zmiana wysokości rat wewnętrznych oraz tygodniowego limitu lekcji.'
});
const LIMIT_CREDIT = Object.freeze([
  EXTEND_ACCESS, EXTRA_LESSONS, TUTLO_PREMIUM, POLISH_LECTURERS,
  ANNEX_48,
  card('30', 'Aneks 30 — Spłata jednej raty kredytowej', 'planned'),
  card('30a', 'Aneks 30a — Spłata dwóch rat kredytowych', 'planned')
]);

const INTERNAL_VARIANTS = new Set(['internal_24', 'internal_2', 'internal_13', 'internal_4']);

export const POST_PAYMENT_CHANGE_ANNEXES = Object.freeze([
  card('45b', '45b – Kurs z limitem tygodniowym', 'planned', {
    desc: 'Wymaga zmiany formy płatności.', enabled: false
  }),
  card('29', '29 – Spłata jednej raty wewnętrznej', 'tutlo', {
    desc: 'Wymaga zmiany formy płatności.',
    enabled: true, mode: 'post_payment_change'
  }),
  card('29a', '29a – Spłata dwóch rat wewnętrznych', 'tutlo', {
    desc: 'Wymaga zmiany formy płatności.',
    enabled: true, mode: 'post_payment_change'
  }),
  card('11a', '11a – Zawieszenie po zmianie formy płatności', 'planned', {
    desc: 'Wymaga zmiany formy płatności.', enabled: false
  })
]);

const ANNEX_45E = card('45e', '45e – Zmiana limitu tygodniowego po zmianie formy płatności', 'tutlo', {
  desc: 'Zmiana raty i limitu tygodniowego po przejściu z kredytu na raty Tutlo.',
  enabled: true,
  mode: 'post_payment_change'
});

export function getPostPaymentChangeAnnexCards(currentContract) {
  if (currentContract?.paymentType !== 'credit' || currentContract?.paymentVariant !== 'credit') return [];
  if (currentContract.contractType === 'limit') return [...POST_PAYMENT_CHANGE_ANNEXES, ANNEX_45E];
  return currentContract.contractType === 'flexible' ? POST_PAYMENT_CHANGE_ANNEXES : [];
}

/**
 * Central card availability matrix. It intentionally reads only the three
 * classification fields produced by the contract parser.
 */
export function getAvailableAnnexCards(currentContract) {
  const { contractType, paymentType, paymentVariant, familyGroupVariant } = currentContract ?? {};
  const familyGroupCards = isAnnex43Available({ contractType, familyGroupVariant })
    ? [PAID_FAMILY_GROUP] : [];
  const annex48Cards = contractType === 'limit' ? [ANNEX_48] : [];

  if (contractType === 'flexible' && paymentType === 'internal'
      && INTERNAL_VARIANTS.has(paymentVariant)) {
    return paymentVariant === 'internal_24'
      ? [card('25', 'Aneks 25 — Zmniejszenie rat wewnętrznych', 'tutlo'), ANNEX_45,
          ...FLEXIBLE_INTERNAL_EXTERNAL, ...familyGroupCards,
          ...FLEXIBLE_INTERNAL_PLANNED.map(item => ['11', '29', '29a'].includes(item.no)
            ? card(item.no, item.name, 'tutlo') : item)]
      : [...FLEXIBLE_INTERNAL_EXTERNAL, ...FLEXIBLE_INTERNAL_PLANNED, ...familyGroupCards];
  }
  if (contractType === 'flexible' && paymentType === 'credit' && paymentVariant === 'credit') {
    return [...FLEXIBLE_CREDIT, ...familyGroupCards];
  }
  if (contractType === 'limit' && paymentType === 'internal'
      && INTERNAL_VARIANTS.has(paymentVariant)) {
    return [...(paymentVariant === 'internal_24' ? [ANNEX_45C] : []), ...LIMIT_INTERNAL, ...familyGroupCards];
  }
  if (contractType === 'limit' && paymentType === 'credit' && paymentVariant === 'credit') {
    return [...LIMIT_CREDIT, ...familyGroupCards];
  }
  return [...annex48Cards, ...familyGroupCards];
}

/** The single availability predicate shared by routing and card-based UI flows. */
export function isAnnexAvailable(annexId, currentContract) {
  const id = String(annexId);
  return [...getAvailableAnnexCards(currentContract), ...getPostPaymentChangeAnnexCards(currentContract)]
    .some(item => item.no === id && item.status === 'tutlo' && item.enabled !== false);
}
