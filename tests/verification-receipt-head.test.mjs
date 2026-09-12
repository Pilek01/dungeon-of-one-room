import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../scripts/verify-online-v3.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function reusableReceipt(input)');
const end = source.indexOf('async function writeReceipt(', start);
function reader(receipt) {
  return vm.runInNewContext(source.slice(start,end) + '; reusableReceipt', {
    FORCE:false, MODE:'full', RECEIPT_SCHEMA:1, receiptPathFor:()=> 'receipt.json',
    fs:{readFile:async()=>JSON.stringify(receipt)}
  });
}
const receipt={schema:1, mode:'full', result:'PASS', head:'old-commit', fingerprint:'same-clean-tree'};
test('a clean new commit cannot reuse the previous commit PASS', async()=> {
  assert.equal(await reader(receipt)({head:'new-commit',fingerprint:receipt.fingerprint}),null);
});
test('an identical commit and fingerprint reuse its PASS', async()=> {
  assert.equal((await reader(receipt)({head:receipt.head,fingerprint:receipt.fingerprint})).head,receipt.head);
});
test('changed uncommitted inputs cannot reuse the same commit PASS', async()=> {
  assert.equal(await reader(receipt)({head:receipt.head,fingerprint:'changed'}),null);
});
