import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { toSpreadsheetCell, toCsvCell } from '../src/utils/spreadsheet.ts';

const attacks = [
  '=1+1', '+SUM(1,2)', '-1+1', '@SUM(1,2)',
  ' =1+1', '\t=1+1', '\r=1+1', '\n=1+1', '\0=1+1', '\u001b=1+1',
  '\u007f=1+1', '\u0085=1+1', '\u00a0=1+1', '\ufeff=1+1',
  '\u200b=1+1', '\u202e=1+1', '\u2060=1+1',
  '＝1+1', '＋1+1', '－1+1', '＠SUM(1,2)',
  '=HYPERLINK("https://example.invalid","test")',
  '=1+1,"\n=2+2', '\tplain text', '\nplain text',
];
const safeValues = ['學生', 'A++', 'test@example.invalid', 'SH2026101713',
  'hello, "world"\nsecond line', "'=1+1", '', null, undefined, 0, 3.5, -3.5, true, false];

function gasContext() {
  const writes = [];
  const sheet = { appendRow: row => writes.push(Array.from(row)), getLastRow: () => 0 };
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
    Utilities: { formatDate: () => '2026101713' },
    ContentService: { createTextOutput: text => ({ setMimeType: () => text }), MimeType: { JSON: 'json' } },
  });
  vm.runInContext(fs.readFileSync(new URL('../GAS_Backend.js', import.meta.url), 'utf8'), context);
  return { context, writes };
}

// Parse quoted CSV to verify commas, quotes and embedded newlines cannot create extra cells.
function parseCsv(csv) {
  const rows = [[]];
  let cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (ch === ',' || ch === '\n')) {
      rows.at(-1).push(cell); cell = '';
      if (ch === '\n') rows.push([]);
    } else cell += ch;
  }
  assert.equal(quoted, false);
  rows.at(-1).push(cell);
  return rows;
}

test('dangerous prefixes are text; safe values and numeric types are preserved in both runtimes', () => {
  const { context } = gasContext();
  for (const value of attacks) {
    assert.equal(toSpreadsheetCell(value), "'" + value);
    assert.equal(context.toSpreadsheetCell(value), "'" + value);
    assert.equal(toSpreadsheetCell(toSpreadsheetCell(value)), "'" + value);
  }
  for (const value of safeValues) {
    const expected = value == null ? '' : value;
    assert.equal(toSpreadsheetCell(value), expected);
    assert.equal(context.toSpreadsheetCell(value), expected);
  }
  // JSON arrays can stringify to formula-prefixed text as well.
  assert.equal(toSpreadsheetCell(['=1+1']), "'=1+1");
  assert.equal(context.toSpreadsheetCell(['=1+1']), "'=1+1");
});

test('CSV escaping preserves cell boundaries and neutralizes formulas', () => {
  const values = [...attacks, ...safeValues];
  const csv = values.map(toCsvCell).join(',');
  assert.deepEqual(parseCsv(csv), [values.map(value => String(toSpreadsheetCell(value)))]);
});

test('actual admin export sanitizes every output cell, including custom-answer text', () => {
  const source = fs.readFileSync(new URL('../src/pages/Admin.tsx', import.meta.url), 'utf8');
  const rowCode = source.slice(source.indexOf('const generateRow ='), source.indexOf('const csvContent ='))
    .replace('(row: any)', '(row)');
  const context = vm.createContext({ toCsvCell, formatCustomAnswers: () => '\t=1+1' });
  vm.runInContext(rowCode + '\nglobalThis.exportRow = generateRow;', context);
  for (const value of attacks) {
    const row = Object.fromEntries(['examYear', 'region', 'identity', 'chineseScore', 'mathScore',
      'englishScore', 'socialScore', 'scienceScore', 'essayScore', 'minRatio', 'maxRatio',
      'minRankInterval', 'maxRankInterval', 'email', 'inviteCode'].map(key => [key, value]));
    row.timestamp = '2026-10-17T00:00:00Z';
    const cells = parseCsv(context.exportRow(row))[0];
    assert.equal(cells.length, 17);
    assert.deepEqual(cells.slice(1, 16), Array(15).fill("'" + value));
    assert.equal(cells[16], "'\t=1+1");
  }
});

test('GAS safe row boundary sanitizes every cell before writing', () => {
  const { context, writes } = gasContext();
  const sheet = { appendRow: row => writes.push(Array.from(row)) };
  context.appendSafeRow(sheet, attacks);
  assert.deepEqual(writes[0], attacks.map(value => "'" + value));
});

test('GAS setup retains normal header names', () => {
  const { context, writes } = gasContext();
  context.setup();
  assert.equal(writes.length, 2);
  assert.equal(writes[0][0], '時間戳記');
  assert.equal(writes[0].at(-1), 'email');
});
