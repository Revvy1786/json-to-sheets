// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { jsonToTable, toCSV, toTSV } = require('../js/converter.js');

test('parallel arrays become rows', () => {
  const t = jsonToTable({ date: ['2024-03-25', '2024-03-26'], price: [100, 150] });
  assert.deepEqual(t.columns, ['date', 'price']);
  assert.deepEqual(t.rows, [
    { date: '2024-03-25', price: 100 },
    { date: '2024-03-26', price: 150 }
  ]);
});

test('reads every items[].value, not only the first, and adds an "item" column', () => {
  const t = jsonToTable({
    items: [
      { value: { date: ['a', 'b'], price: [1, 2] } },
      { value: { date: ['c'], price: [3] } }
    ]
  });
  assert.equal(t.rows.length, 3);
  assert.deepEqual(t.columns, ['item', 'date', 'price']);
  assert.deepEqual(t.rows[2], { item: 1, date: 'c', price: 3 });
});

test('non-array fields next to parallel arrays are ignored', () => {
  const t = jsonToTable({ value: { date: ['a'], price: [1], status: 'ok' } });
  assert.deepEqual(t.columns, ['date', 'price']);
});

test('array of objects with nested fields is flattened', () => {
  const t = jsonToTable([
    { id: 1, guest: { country: 'IT', nights: 2 } },
    { id: 2, guest: { country: 'CH' }, tags: ['vip'] }
  ]);
  assert.deepEqual(t.columns, ['id', 'guest.country', 'guest.nights', 'tags']);
  assert.equal(t.rows[1]['guest.country'], 'CH');
});

test('arrays of different length raise a clear error', () => {
  assert.throws(
    () => jsonToTable({ date: ['a', 'b'], price: [1] }),
    /different lengths \(date: 2, price: 1\)/
  );
});

test('primitives and empty arrays raise errors', () => {
  assert.throws(() => jsonToTable(42), /expected an object or an array/);
  assert.throws(() => jsonToTable([]), /No rows found/);
});

test('CSV escapes commas, quotes and newlines', () => {
  const csv = toCSV({ columns: ['a'], rows: [{ a: 'x,"y"\nz' }] });
  assert.equal(csv, 'a\r\n"x,""y""\nz"');
});

test('CSV/TSV neutralise formulas but keep negative numbers', () => {
  const table = { columns: ['a', 'b', 'c'], rows: [{ a: '=HYPERLINK("x")', b: -5, c: '-5' }] };
  assert.equal(toCSV(table).split('\r\n')[1], `"'=HYPERLINK(""x"")",-5,-5`);
  assert.equal(toTSV(table).split('\n')[1], `'=HYPERLINK("x")\t-5\t-5`);
});

test('TSV replaces tabs and newlines inside cells', () => {
  const tsv = toTSV({ columns: ['a'], rows: [{ a: 'x\ty\nz' }] });
  assert.equal(tsv, 'a\nx y z');
});
