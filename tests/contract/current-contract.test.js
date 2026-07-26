import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCurrentContract } from '../../src/domain/contract-extraction.js';
import { CURRENT_CONTRACT_FIELDS, validateCurrentContract } from '../../src/domain/current-contract-validation.js';
import { scenarios } from '../fixtures/contracts/scenarios.js';
const expectedVariants=['credit','credit','internal_24','internal_24','internal_2','internal_13','internal_4','credit','internal_24'];
for(const [index,[name,text]] of scenarios.entries()) test(`pełny currentContract: ${name}`,()=>{
 const contract=parseCurrentContract(text);
 assert.deepEqual(Object.keys(contract),CURRENT_CONTRACT_FIELDS);
 assert.equal(contract.paymentVariant,expectedVariants[index]);
 assert.equal(contract.contractType,name.startsWith('limit')?'limit':'flexible');
 assert.equal(contract.customerType,name.includes('company')?'company':'person');
 assert.equal(contract.personalId,name.includes('company')?'1234567890':'12345678901');
 assert.equal(contract.agreementDate,'2025-09-03'); assert.equal(contract.coursePriceCents,957600);
 if(contract.paymentType==='internal') assert.equal(contract.installmentPlan.paymentCount,Number(contract.paymentVariant.split('_')[1]));
 assert.equal(validateCurrentContract(contract).valid,true,validateCurrentContract(contract).issues.join('\n'));
});
test('walidacja wykrywa brak pola, stary alias i zależności wariantu',()=>{
 const contract={...parseCurrentContract(scenarios[2][1])}; delete contract.personalId; contract.pesel='12345678901'; contract.installmentPlan={...contract.installmentPlan,paymentCount:2};
 const result=validateCurrentContract(contract); assert.equal(result.valid,false); assert.match(result.issues.join(' '),/personalId|installmentPlan/);
});
test('aneksy 25 i 26 nie parsują standardowych pól ani rawText',async()=>{
 for(const id of ['25','26']) { const source=await readFile(new URL(`../../src/annexes/${id}/generator.js`,import.meta.url),'utf8'); assert.doesNotMatch(source,/rawText|extract(?:Agreement|Contract|Course|Internal)|\.pesel|teacherTypes|monthlyLimit/); }
});
test('UI wykonuje ekstrakcję PDF i wspólny parser dokładnie raz',async()=>{
 const html=await readFile(new URL('../../index.html',import.meta.url),'utf8'); assert.equal((html.match(/processContractPdf\(currentFile/g)||[]).length,1); assert.doesNotMatch(html,/parseCurrentContract\(/);
});
