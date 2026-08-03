import assert from 'node:assert/strict';
import test from 'node:test';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';

const ids=contract=>getAvailableAnnexCards(contract).map(card=>card.no);

test('dostępność korzysta z kanonicznego typu limit',()=>{
  const canonical=ids({contractType:'limit',paymentType:'credit',paymentVariant:'credit'});
  assert.ok(canonical.length>0);
  assert.deepEqual(ids({contractType:'limited',paymentType:'credit',paymentVariant:'credit'}),[]);
});

test('Aneks 26 jest dostępny dla pełnej kombinacji flexible/credit/credit',()=>{
  assert.ok(ids({contractType:'flexible',paymentType:'credit',paymentVariant:'credit'}).includes('26'));
  assert.ok(!ids({contractType:'limit',paymentType:'credit',paymentVariant:'credit'}).includes('26'));
});

test('karty nie powtarzają identyfikatorów i nie mutują currentContract',()=>{
  const contract={contractType:'flexible',paymentType:'internal',paymentVariant:'internal_24'};
  const before=structuredClone(contract);const cards=getAvailableAnnexCards(contract);
  assert.equal(new Set(cards.map(card=>card.no)).size,cards.length);assert.deepEqual(contract,before);
});

test('niepełna lub nieobsługiwana klasyfikacja nie zwraca kart',()=>{
  assert.deepEqual(getAvailableAnnexCards(undefined),[]);
  assert.deepEqual(getAvailableAnnexCards({contractType:'flexible',paymentType:'credit'}),[]);
});
