import assert from 'node:assert/strict';
import test from 'node:test';
import { annexModules } from '../src/annexes/catalog.js';
import { getAnnexRoute } from '../router.js';

const IDS=['11','25','25a','26','27','29','29a','43','45','45c','45e','48'];
const contractFor=id=>id==='43'?{contractType:'flexible',familyGroupVariant:'paid'}:id==='45'?{contractType:'flexible',paymentType:'internal',paymentVariant:'internal_24'}:id==='45c'?{contractType:'limit',paymentType:'internal',paymentVariant:'internal_24'}:id==='48'?{contractType:'limit'}:undefined;

test('każdy aktywny moduł ma trasę zgodną z katalogiem',()=>{
  for(const id of IDS){const route=getAnnexRoute(id,contractFor(id));const module=annexModules.get(id);assert.equal(route.number,module.manifest.id);assert.equal(route.name,module.manifest.label);assert.deepEqual(route.requiredPlaceholders,module.manifest.requiredFields)}
});

test('identyfikatory literowe pozostają stringami',()=>{
  for(const id of ['29a','45c','45e']) assert.equal(typeof getAnnexRoute(id,contractFor(id)).number,'string');
});

test('katalog i router są spójne, bez historycznego Aneksu 35',()=>{
  assert.deepEqual([...annexModules.keys()],IDS);assert.equal(getAnnexRoute('35'),undefined);assert.equal(getAnnexRoute('unknown'),undefined);
});
