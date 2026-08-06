import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { annexModules, getAnnexModule } from '../../src/annexes/catalog.js';
import { extractDocxPlaceholders } from '../../src/annexes/shared/template-inspection.js';

const EXPECTED_IDS=['11','25','25a','26','27','29','29a','43','45','45c','45e','48'];

test('katalog udostępnia dokładnie aktywne generatory',()=>{
  assert.deepEqual([...annexModules.keys()],EXPECTED_IDS);
  for(const id of EXPECTED_IDS){assert.equal(typeof id,'string');assert.equal(getAnnexModule(id)?.manifest.id,id)}
  assert.equal(getAnnexModule('35'),undefined);
});

for(const [id,annex] of annexModules){
  test(`aneks ${id}: manifest opisuje logiczne pola własnego DOCX`,async()=>{
    const fields=new Set(extractDocxPlaceholders(await readFile(new URL(`../../src/annexes/${id}/${annex.manifest.template}`,import.meta.url))));
    assert.ok(fields.size>0);
    assert.ok(annex.manifest.requiredFields.length>0);
    if(annex.manifest.requiredFields.includes('RATY')) {
      for(const field of ['#RATY','/RATY','NUMER_RATY','KWOTA','TERMIN']) assert.ok(fields.has(field),`brak pola sekcji ${field}`);
    }
  });
}
