import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { getAnnexRoute } from '../../router.js';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';
import { annexModules, getAnnexModule } from '../../src/annexes/catalog.js';

const ACTIVE_IDS = ['11', '25', '26', '27', '29', '29a', '43', '45', '45c', '45e', '48'];

const annex25Contracts = [
  [{ contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24' }, true],
  [{ contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' }, false],
  [{ contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_24' }, false],
  ...['internal_2', 'internal_4', 'internal_13'].map(paymentVariant => [
    { contractType: 'flexible', paymentType: 'internal', paymentVariant }, false
  ])
];

test('centralny katalog runtime zawiera Aneks 25 dokładnie raz we właściwej kolejności', () => {
  assert.deepEqual([...annexModules.keys()], ACTIVE_IDS);
  assert.equal([...annexModules.keys()].filter(id => id === '25').length, 1);
  assert.equal(getAnnexModule('25')?.manifest.id, '25');
});

test("getAnnexRoute('25') udostępnia manifest i template Aneksu 25", () => {
  const annex25 = getAnnexModule('25');
  const route = getAnnexRoute('25');

  assert.equal(route.number, annex25.manifest.id);
  assert.equal(route.name, annex25.manifest.label);
  assert.equal(route.template, annex25.manifest.template);
  assert.deepEqual(route.requiredPlaceholders, annex25.manifest.requiredFields);
});

test('Aneks 25 pozostaje widoczny wyłącznie dla flexible/internal/internal_24', () => {
  for (const [contract, expected] of annex25Contracts) {
    const cards = getAvailableAnnexCards(contract).filter(card => card.no === '25');
    assert.equal(cards.length, expected ? 1 : 0);
    assert.equal(cards[0]?.status === 'tutlo', expected);
  }
});

test('kliknięcie aktywnej karty 25 pozostaje połączone z właściwym generatorem', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

  assert.match(html, /openGenerator\(item\.no,item\.mode\|\|'standard'\)/);
  assert.match(html, /if\(no==='25'\)[\s\S]*?annex25Dialog'\)\.showModal\(\)/);
  assert.match(html, /prepareAnnex25\(currentContract/);
  assert.match(html, /downloadAnnex25\(prepared/);
});

test('każda aktywna karta Tutlo ma gotowy moduł runtime', () => {
  const contracts = [
    ...annex25Contracts.map(([contract]) => contract),
    { contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' },
    { contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit' },
    { familyGroupVariant: 'paid' }
  ];

  for (const contract of contracts) {
    for (const card of getAvailableAnnexCards(contract).filter(({ status }) => status === 'tutlo')) {
      assert.ok(getAnnexModule(card.no), `brak modułu runtime dla aktywnej karty ${card.no}`);
    }
  }
});

test('każdy aktywny moduł ma manifest, generator i template URL', async () => {
  for (const [id, annex] of annexModules) {
    assert.equal(annex.manifest.id, id);
    assert.equal(annex.manifest.status, 'ready');
    assert.ok(Object.keys(annex).some(name => name.startsWith('prepareAnnex')));
    assert.equal(typeof annex.manifest.template, 'string');
    await access(new URL(`../../src/annexes/${id}/${annex.manifest.template}`, import.meta.url));
  }
});
