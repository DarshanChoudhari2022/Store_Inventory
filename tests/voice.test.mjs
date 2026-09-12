import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceValue} from '../app/retail/voice-domain.ts';

test('dictation replaces selected text while retaining surrounding words', () => {
  assert.equal(voiceValue('Green tea', 'Black', 'text', 0, 5), 'Black tea');
  assert.equal(voiceValue('Green', 'tea', 'text', 5, 5), 'Green tea');
  assert.equal(voiceValue('', 'दूध', 'text', 0, 0), 'दूध');
});
test('dictated amounts replace the amount and preserve decimal precision', () => {
  assert.equal(voiceValue('10', '२५.५०', 'number', null, null), '25.50');
  assert.equal(voiceValue('10', '1,250.50', 'number', null, null), '1250.50');
  assert.equal(voiceValue('', '1,25,000', 'number', null, null), '125000');
  for (const value of ['twenty five', '25 rupees', '1,5', 'Infinity', '10 + 5', '']) {
    assert.equal(voiceValue('10', value, 'number', null, null), null);
  }
});
test('dictated phone numbers retain leading zeroes; dates require explicit ISO format', () => {
  assert.equal(voiceValue('', '०१२३ ४५६ ७८९', 'tel', null, null), '0123456789');
  assert.equal(voiceValue('', 'tomorrow', 'date', null, null), null);
  assert.equal(voiceValue('', '2026-09-12', 'date', null, null), '2026-09-12');
});
