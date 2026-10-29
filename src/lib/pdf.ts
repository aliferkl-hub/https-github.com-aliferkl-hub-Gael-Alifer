/**
 * PDF Contract Generator and A4 Print Utilities
 * Formats professional documents with headers, numbered terms, margins, pagination, and signatures
 */

import { jsPDF } from 'jspdf';
import { Contract } from '../types/index.ts';

export function generateContractPdf(contract: Contract, companyName = 'ONNIX PLAY', companyCnpj = '00.000.000/0001-00'): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Header
  doc.setFillColor(11, 19, 43); // Navy background header block
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 220, 255);
  doc.text(`CNPJ: ${companyCnpj} | CONTRATO Nº: ${contract.documentNumber}`, margin, 21);

  cursorY = 38;

  // Title
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(contract.title, margin, cursorY);
  cursorY += 8;

  // Metadata badge bar
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, cursorY, contentWidth, 12, 1, 1, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(
    `Status: ${contract.status.toUpperCase()}   |   Emissão: ${contract.issuedAt}   |   Versão: v${contract.version || 1}`,
    margin + 4,
    cursorY + 8
  );
  cursorY += 18;

  // Contract Body Text
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'normal');

  const splitText = doc.splitTextToSize(contract.content, contentWidth);

  for (let i = 0; i < splitText.length; i++) {
    if (cursorY > pageHeight - 45) {
      // Add page
      doc.addPage();
      cursorY = margin;
      // Header on next page
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`${companyName} — Contrato ${contract.documentNumber}`, margin, cursorY);
      cursorY += 10;
      doc.setFontSize(9.5);
      doc.setTextColor(31, 41, 55);
    }
    doc.text(splitText[i], margin, cursorY);
    cursorY += 5;
  }

  // Ensure room for signatures
  if (cursorY > pageHeight - 55) {
    doc.addPage();
    cursorY = margin + 15;
  } else {
    cursorY += 15;
  }

  // Signatures
  const colWidth = (contentWidth - 10) / 2;
  const sigY = cursorY + 15;

  // Contratada line
  doc.setDrawColor(156, 163, 175);
  doc.line(margin, sigY, margin + colWidth, sigY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text(companyName, margin + colWidth / 2, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('CONTRATADA', margin + colWidth / 2, sigY + 9, { align: 'center' });

  // Contratante line
  doc.line(margin + colWidth + 10, sigY, margin + contentWidth, sigY);
  doc.setFont('helvetica', 'bold');
  const clientName = contract.dynamicValues?.nome_cliente || 'CONTRATANTE';
  doc.text(clientName, margin + colWidth + 10 + colWidth / 2, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`CPF: ${contract.dynamicValues?.cpf_cliente || '***'}`, margin + colWidth + 10 + colWidth / 2, sigY + 9, { align: 'center' });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(`ONNIX PLAY Gestão — Documento autenticado eletronicamente`, margin, pageHeight - 10);
  }

  doc.save(`${contract.documentNumber}.pdf`);
}

/**
 * Triggers native browser print preview for A4 paper
 */
export function printContractDocument(elementId: string): void {
  const content = document.getElementById(elementId);
  if (!content) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Imprimir Contrato - ONNIX PLAY</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 11pt;
            line-height: 1.6;
          }
          h1, h2, h3 {
            color: #0b1329;
          }
          .header-box {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .signature-box {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-line {
            width: 45%;
            border-top: 1px solid #374151;
            padding-top: 8px;
            text-align: center;
            font-size: 9pt;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
