export const ANNEX_STATUSES = Object.freeze({
  tutlo: Object.freeze({ label: 'Generator Tutlo', className: 'generator-tutlo' }),
  external: Object.freeze({ label: 'Aneks w Team Tutlo', className: 'external-generator' }),
  planned: Object.freeze({ label: 'W przygotowaniu', className: 'in-preparation' })
});

const ALL_ANNEXES = Object.freeze([
  { no: '11', name: 'Zawieszenie umowy', status: 'tutlo' },
  { no: '25', name: 'Zmniejszenie rat wewnętrznych', desc: 'Dla umowy elastycznej na 24 raty wewnętrzne.', status: 'tutlo', when: c => c?.type === 'flexible' && c?.payment === 'internal' && c?.variant === '24 równe raty miesięczne' },
  { no: '26', name: 'Zmniejszenie rat kredytowych', status: 'tutlo' },
  { no: '29', name: 'Jedna rata gratis', status: 'tutlo' },
  { no: '29a', name: 'Dwie raty gratis', status: 'tutlo' },
  { no: 'wydluzenie-dostepu', marker: '↗', name: 'Wydłużenie dostępu', desc: 'Dostępny dla każdej umowy.', status: 'external' },
  { no: '20-lekcji-gratis', marker: '20', name: '20 lekcji gratis', desc: 'Tylko dla umów elastycznych.', status: 'external', when: c => c?.type === 'flexible' },
  { no: 'rozlozenie-platnosci', marker: 'R', name: 'Rozłożenie płatności', desc: 'Tylko dla rat wewnętrznych.', status: 'external', when: c => c?.payment === 'internal' },
  { no: 'tutlo-premium', marker: 'P', name: 'Aneks Tutlo Premium', desc: 'Dostępny dla każdej umowy.', status: 'external' },
  { no: 'lektorzy-pl', marker: 'PL', name: 'Rozszerzenie pakietu lektorów', desc: 'Dostępny, gdy umowa nie obejmuje lektorów PL.', status: 'external', when: c => c?.hasPolishLecturers === false },
  { no: '45', name: 'Aneks 45', desc: 'Tylko dla umowy z limitem finansowanej kredytem.', status: 'external', when: c => c?.type === 'limit' && c?.payment === 'credit' },
  { no: '10', name: 'Aneks 10', desc: 'Zmiana formy płatności.', status: 'planned' },
  { no: '43', name: 'Grupa rodzinna (Tutlo Plus)', desc: 'Dodanie grupy rodzinnej.', status: 'tutlo', when: c => c?.hasFamilyAdditionalFee === true },
  { no: '47', name: 'Aneks 47', desc: 'Przejście z limitu na umowę elastyczną.', status: 'planned' },
  { no: 'grupa-rodzinna', marker: 'GR', name: 'Grupa rodzinna', status: 'planned' },
  { no: '9', name: 'Aneks 9', desc: 'Niewdrożony aneks.', status: 'planned' },
  { no: '27', name: 'Aneks 27', desc: 'Zmniejszenie rat i przejście na raty wewnętrzne.', status: 'planned' },
  { no: '28', name: 'Aneks 28', desc: 'Rata gratis.', status: 'planned' },
  { no: '48', name: 'Aneks 48', desc: 'Zdjęcie limitu.', status: 'planned' }
]);

const FLEXIBLE_CREDIT_ANNEXES = Object.freeze([
  { no: '26', name: 'Zmniejszenie rat kredytowych', status: 'tutlo' },
  { no: 'wydluzenie-dostepu', marker: '↗', name: 'Wydłużenie dostępu', desc: 'Dostępny dla każdej umowy.', status: 'external' },
  { no: '20-lekcji-gratis', marker: '20', name: '20 lekcji gratis', desc: 'Tylko dla umów elastycznych.', status: 'external' },
  { no: 'tutlo-premium', marker: 'P', name: 'Aneks Tutlo Premium', desc: 'Dostępny dla każdej umowy.', status: 'external' },
  { no: '10', name: 'Aneks 10', desc: 'Zmiana formy płatności.', status: 'planned' },
  { no: '43', name: 'Grupa rodzinna (Tutlo Plus)', desc: 'Dodanie grupy rodzinnej.', status: 'planned', when: c => c?.hasFamilyAdditionalFee === true },
  { no: '28', name: 'Aneks 28', desc: 'Rata gratis.', status: 'planned' },
  { no: '27', name: 'Aneks 27', desc: 'Zmniejszenie rat i przejście na raty wewnętrzne.', status: 'planned' }
]);

/** Central, deterministic availability rule consumed by both card views. */
export function getAvailableAnnexCards(contract) {
  const catalog = contract?.type === 'flexible' && contract?.payment === 'credit'
    ? FLEXIBLE_CREDIT_ANNEXES
    : ALL_ANNEXES;
  return catalog.filter(item => !item.when || item.when(contract));
}
