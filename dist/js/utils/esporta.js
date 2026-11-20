// Esportazioni dei report: CSV con il punto e virgola e il BOM, così Excel in
// italiano lo apre già diviso in colonne e con le lettere accentate giuste.
export function scaricaCsv(nome, righe) {
  const cella = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const testo = '﻿' + righe.map(r => r.map(cella).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([testo], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// I numeri nel CSV restano numeri per Excel: virgola decimale, niente separatore delle migliaia.
export const numeroCsv = n => n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ',');
