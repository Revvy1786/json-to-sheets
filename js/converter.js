/**
 * converter.js — pure conversion logic (no DOM).
 *
 * Kept separate from the UI so it can be tested with Node
 * (see tests/converter.test.js) and reused elsewhere.
 *
 * Public API:
 *   jsonToTable(data)  -> { columns: string[], rows: object[] }
 *   toCSV(table, sep)  -> string
 *   toTSV(table)       -> string (for pasting into Google Sheets / Excel)
 */
const Converter = (() => {
  'use strict';

  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  /**
   * Flattens nested objects: { a: { b: 1 } } -> { "a.b": 1 }.
   * Arrays are left as they are (they end up as JSON text in the cell).
   */
  function flatten(obj, prefix = '', out = {}) {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isObject(value) && Object.keys(value).length > 0) {
        flatten(value, path, out);
      } else {
        out[path] = value;
      }
    }
    return out;
  }

  /**
   * Turns ONE data source into rows. Three shapes are supported:
   *   1. array of objects        [{date, price}, {date, price}]
   *   2. object of parallel arrays { date: [...], price: [...] }
   *   3. a single object          { date, price }  -> one row
   */
  function rowsFrom(source, label) {
    if (Array.isArray(source)) {
      if (source.length === 0) return [];
      if (source.every(isObject)) return source.map((item) => flatten(item));
      // Array of plain values: one column called "value"
      return source.map((v) => ({ value: v }));
    }

    if (isObject(source)) {
      const arrayKeys = Object.keys(source).filter((k) => Array.isArray(source[k]));

      if (arrayKeys.length === 0) return [flatten(source)];

      const lengths = arrayKeys.map((k) => source[k].length);
      if (new Set(lengths).size > 1) {
        const detail = arrayKeys.map((k, i) => `${k}: ${lengths[i]}`).join(', ');
        throw new Error(`${label}: arrays have different lengths (${detail}).`);
      }

      // Non-array fields (metadata, status, ...) are ignored on purpose.
      return source[arrayKeys[0]].map((_, i) => {
        const row = {};
        for (const k of arrayKeys) row[k] = source[k][i];
        return row;
      });
    }

    throw new Error(`${label}: expected an object or an array, got ${source === null ? 'null' : typeof source}.`);
  }

  /** Column order = order of first appearance across all rows. */
  function collectColumns(rows) {
    const seen = new Set();
    for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
    return [...seen];
  }

  /**
   * Entry point. Finds where the data is, like the original tool did:
   *   { items: [ { value: {...} }, ... ] }  -> every item's "value"
   *   { value: {...} }                      -> "value"
   *   anything else                          -> the root itself
   */
  function jsonToTable(data) {
    let sources;

    if (isObject(data) && Array.isArray(data.items) && data.items.length > 0 &&
        data.items.every((it) => isObject(it) && 'value' in it)) {
      sources = data.items.map((it, i) => ({ data: it.value, label: `items[${i}].value` }));
    } else if (isObject(data) && 'value' in data) {
      sources = [{ data: data.value, label: 'value' }];
    } else {
      sources = [{ data, label: 'root' }];
    }

    const rows = [];
    sources.forEach((src, i) => {
      const part = rowsFrom(src.data, src.label);
      // With more than one item, keep track of where each row came from.
      if (sources.length > 1) part.forEach((row) => rows.push({ item: i, ...row }));
      else rows.push(...part);
    });

    if (rows.length === 0) throw new Error('No rows found: the arrays are empty.');
    return { columns: collectColumns(rows), rows };
  }

  // ---------- Export ----------

  function cellText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Spreadsheet apps execute cells starting with = + - @ as formulas
   * ("CSV injection"). Text values like that get a leading apostrophe.
   * Real numbers (e.g. -5) are left alone.
   */
  function safeText(value) {
    const text = cellText(value);
    if (typeof value === 'string' && /^[=+\-@]/.test(text) && isNaN(Number(text))) {
      return `'${text}`;
    }
    return text;
  }

  function csvCell(value, sep) {
    const text = safeText(value);
    const needsQuotes = text.includes(sep) || /["\r\n]/.test(text);
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCSV(table, sep = ',') {
    const lines = [table.columns.map((c) => csvCell(c, sep)).join(sep)];
    for (const row of table.rows) {
      lines.push(table.columns.map((c) => csvCell(row[c], sep)).join(sep));
    }
    return lines.join('\r\n');
  }

  function tsvCell(value) {
    // Tabs and newlines would break the paste into separate cells/rows.
    return safeText(value).replace(/[\t\r\n]+/g, ' ');
  }

  function toTSV(table) {
    const lines = [table.columns.map(tsvCell).join('\t')];
    for (const row of table.rows) {
      lines.push(table.columns.map((c) => tsvCell(row[c])).join('\t'));
    }
    return lines.join('\n');
  }

  return { jsonToTable, toCSV, toTSV, cellText, flatten };
})();

// Lets Node's test runner import this file; ignored by the browser.
if (typeof module !== 'undefined') module.exports = Converter;
