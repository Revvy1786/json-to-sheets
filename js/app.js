/**
 * app.js — user interface: reads the textarea, calls Converter,
 * draws the table and handles copy / download.
 */
(() => {
  'use strict';

  const PREVIEW_LIMIT = 500; // rows drawn on screen; exports always contain everything

  // Fictional data, safe to show publicly.
  const SAMPLE = {
    metadata: { source: 'demo-api', generatedAt: '2024-03-24T10:00:00Z' },
    items: [
      { value: { date: ['2024-03-25', '2024-03-26', '2024-03-27'], price: [100, 150, 135.5], roomId: [101, 101, 101] } },
      { value: { date: ['2024-03-25', '2024-03-26'], price: [89, 95], roomId: [202, 202] } }
    ],
    status: { code: 200 }
  };

  const $ = (id) => document.getElementById(id);
  let currentTable = null;

  $('convertBtn').addEventListener('click', processJson);
  $('copyBtn').addEventListener('click', copyToClipboard);
  $('downloadBtn').addEventListener('click', downloadCSV);
  $('sampleBtn').addEventListener('click', () => {
    $('jsonInput').value = JSON.stringify(SAMPLE, null, 2);
    processJson();
  });

  function processJson() {
    // Reset
    $('errorBox').classList.add('hidden');
    $('resultBox').classList.add('hidden');
    $('emptyBox').classList.remove('hidden');
    currentTable = null;

    const input = $('jsonInput').value.trim();
    if (!input) return;

    let data;
    try {
      data = JSON.parse(input);
    } catch (err) {
      showError('Invalid JSON: ' + err.message);
      return;
    }

    try {
      currentTable = Converter.jsonToTable(data);
    } catch (err) {
      showError(err.message);
      return;
    }

    displayResult(currentTable);
  }

  function showError(message) {
    $('errorText').textContent = message;
    $('errorBox').classList.remove('hidden');
  }

  function displayResult(table) {
    const head = $('resultHead');
    const body = $('resultBody');
    head.replaceChildren();
    body.replaceChildren();

    for (const col of table.columns) {
      const th = document.createElement('th');
      th.className = 'px-4 py-2 text-left whitespace-nowrap';
      th.textContent = col;
      head.appendChild(th);
    }

    table.rows.slice(0, PREVIEW_LIMIT).forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = index % 2 === 0 ? 'bg-gray-50' : 'bg-white';
      for (const col of table.columns) {
        const td = document.createElement('td');
        td.className = 'px-4 py-2 border-b whitespace-nowrap';
        // textContent, NOT innerHTML: data from the JSON is never run as HTML.
        td.textContent = Converter.cellText(row[col]);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });

    const hidden = table.rows.length - PREVIEW_LIMIT;
    $('previewNote').textContent = hidden > 0
      ? `Showing the first ${PREVIEW_LIMIT} rows (${hidden} more in the export).`
      : '';

    $('emptyBox').classList.add('hidden');
    $('resultBox').classList.remove('hidden');
  }

  function copyToClipboard() {
    if (!currentTable) return;

    navigator.clipboard.writeText(Converter.toTSV(currentTable))
      .then(() => {
        const label = $('copyBtnText');
        const original = label.textContent;
        label.textContent = 'Copied!';
        setTimeout(() => { label.textContent = original; }, 2000);
      })
      .catch(() => showError('The browser blocked the clipboard. Use "Download CSV" instead.'));
  }

  function downloadCSV() {
    if (!currentTable) return;

    // "﻿" (BOM) makes Excel read accented characters correctly.
    const csv = '﻿' + Converter.toCSV(currentTable);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.csv';
    document.body.appendChild(a); // Firefox needs the link in the page
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})();
