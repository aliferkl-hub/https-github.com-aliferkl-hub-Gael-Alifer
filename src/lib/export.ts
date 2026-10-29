/**
 * CSV Export Utility
 * Safely encodes and exports reports with UTF-8 BOM for Excel compatibility
 */

export function exportToCsv(filename: string, rows: Record<string, any>[]): void {
  if (!rows || !rows.length) {
    alert('Nenhum dado disponível para exportação.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(';'),
    ...rows.map(row =>
      headers
        .map(fieldName => {
          let value = row[fieldName];
          if (value === null || value === undefined) value = '';
          const str = String(value).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(';')
    ),
  ].join('\r\n');

  // Add UTF-8 BOM for Brazilian Portuguese accents in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
