/**
 * Web Crypto API based PBKDF2 / SHA-256 password hashing and validation
 * Avoids storing plaintext passwords; generates secure cryptographic salt
 */

export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);
  const saltBuffer = enc.encode(salt);

  const importedKey = await globalThis.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    importedKey,
    256
  );

  return Array.from(new Uint8Array(derivedKey), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  if (!password || !salt || !expectedHash) return false;
  const cleanSalt = salt.trim();
  const cleanExpected = expectedHash.trim().toLowerCase();
  const computedHash = await hashPassword(password, cleanSalt);
  return computedHash.toLowerCase() === cleanExpected;
}

export function generateInviteToken(prefix = 'ONX'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const getRandomPart = (len = 4) => {
    let res = '';
    const array = new Uint8Array(len);
    globalThis.crypto.getRandomValues(array);
    for (let i = 0; i < len; i++) {
      res += chars[array[i] % chars.length];
    }
    return res;
  };
  return `${prefix}-${getRandomPart(4)}-${getRandomPart(4)}`;
}

export function generateSecureCompanyInviteCode(prefix = 'ONX-INV'): string {
  return generateInviteToken(prefix);
}
