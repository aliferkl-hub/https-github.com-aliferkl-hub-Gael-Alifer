/**
 * CPF Validation and Masking Utilities
 * Implements strict mod 11 check digits validation
 */

export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function formatCpf(cpf: string): string {
  const cleaned = cleanCpf(cpf);
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function maskCpf(cpf: string): string {
  const cleaned = cleanCpf(cpf);
  if (cleaned.length !== 11) return '***.***.***-**';
  // Expose only the last two digits and first three for identification, masking the middle
  return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(9, 11)}`;
}

export function isValidCpf(cpf: string): boolean {
  const cleaned = cleanCpf(cpf);

  if (cleaned.length !== 11) {
    return false;
  }

  // Known invalid sequences like 111.111.111-11, 000.000.000-00
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return false;
  }

  // Check first verifier digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (10 - i);
  }
  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;

  if (firstDigit !== parseInt(cleaned.charAt(9), 10)) {
    return false;
  }

  // Check second verifier digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (11 - i);
  }
  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;

  return secondDigit === parseInt(cleaned.charAt(10), 10);
}
