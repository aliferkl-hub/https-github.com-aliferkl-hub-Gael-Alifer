/**
 * Date and Recurrence Engine Utilities
 * Consistent with America/Sao_Paulo timezone and month-length variations
 */

import { BillingCycle } from '../types/index.ts';

/**
 * Returns today's date formatted as YYYY-MM-DD in America/Sao_Paulo timezone
 */
export function getTodaySaoPaulo(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Formats YYYY-MM-DD or ISO string to Brazilian format DD/MM/YYYY
 */
export function formatBrDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Formats BRL currency
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calculates days difference between targetDate and baseDate (both YYYY-MM-DD)
 */
export function getDaysDiff(targetDateStr: string, baseDateStr = getTodaySaoPaulo()): number {
  const [y1, m1, d1] = targetDateStr.split('-').map(Number);
  const [y2, m2, d2] = baseDateStr.split('-').map(Number);

  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);

  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
}

/**
 * Recurrence Engine: calculates the next due date based on billing cycle
 * Handles month end clamping safely (e.g. Jan 31 -> Feb 28/29)
 */
export function calculateNextDueDate(currentDueDateStr: string, cycle: BillingCycle, customMonths = 1): string {
  const [year, month, day] = currentDueDateStr.split('-').map(Number);

  let monthsToAdd = 1;
  switch (cycle) {
    case 'mensal':
      monthsToAdd = 1;
      break;
    case 'trimestral':
      monthsToAdd = 3;
      break;
    case 'semestral':
      monthsToAdd = 6;
      break;
    case 'anual':
      monthsToAdd = 12;
      break;
    case 'personalizado':
      monthsToAdd = Math.max(1, customMonths);
      break;
    default:
      monthsToAdd = 1;
  }

  // Calculate new year and month (1-indexed)
  const totalMonths = (year * 12 + (month - 1)) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;

  // Clamp day to max days in newMonth
  const maxDays = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
  const newDay = Math.min(day, maxDays);

  const mm = String(newMonth).padStart(2, '0');
  const dd = String(newDay).padStart(2, '0');
  return `${newYear}-${mm}-${dd}`;
}

/**
 * Determines reference period description (e.g. "Outubro/2026")
 */
export function getReferencePeriod(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mIndex = parseInt(month, 10) - 1;
  return `${monthNames[mIndex] || month}/${year}`;
}
