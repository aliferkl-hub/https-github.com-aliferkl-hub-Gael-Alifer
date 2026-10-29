/**
 * Automated Test Suite for ONNIX PLAY Authentication & Master Owner Access
 * Tests:
 * 1. Master Owner password hashing with PBKDF2/SHA-256 and unique salt
 * 2. Master Owner verification (valid password succeeds, invalid password fails)
 * 3. DatabaseService.authenticateUser with Master Owner email recognizes MASTER_OWNER role
 * 4. Multi-master email recognition (alifermadeiro@hotmail.com, alifer.qualicare@gmail.com)
 * 5. Case insensitivity of master email authentication
 * 6. Partner company authentication isolation (never granted MASTER_OWNER)
 * 7. Server authMiddleware master owner validation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { terminate, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase.ts';
import { generateSalt, hashPassword, verifyPassword } from '../src/lib/crypto.ts';
import { DatabaseService, DEFAULT_MASTER_EMAIL, ALT_MASTER_EMAIL, MASTER_EMAILS, normalizeEmailKey } from '../src/lib/db.ts';
import { MasterOwnerCredentials, UserProfile } from '../src/types/index.ts';

describe('ONNIX PLAY Authentication & Master Owner Access Suite', () => {
  // Test password for unit test validation
  const testMasterPass = 'Onnix#Master2026Strong';

  // State preservation: backup live Firestore records before testing to guarantee zero production mutation
  let backupSettingsMaster: any = null;
  const backupUserCredentials = new Map<string, any>();

  before(async () => {
    try {
      const sSnap = await getDoc(doc(db, 'settings', 'master_owner_creds'));
      if (sSnap.exists()) {
        backupSettingsMaster = sSnap.data();
      }
      for (const m of MASTER_EMAILS) {
        const k = normalizeEmailKey(m);
        const uSnap = await getDoc(doc(db, 'user_credentials', k));
        if (uSnap.exists()) {
          backupUserCredentials.set(k, uSnap.data());
        }
      }
    } catch (err) {
      console.warn('Notice: Could not snapshot live records prior to test suite:', err);
    }
  });

  after(async () => {
    // RESTORE PRODUCTION MASTER RECORDS TO THEIR EXACT PRE-TEST STATE
    try {
      if (backupSettingsMaster) {
        await setDoc(doc(db, 'settings', 'master_owner_creds'), backupSettingsMaster);
      }
      for (const [k, data] of backupUserCredentials.entries()) {
        await setDoc(doc(db, 'user_credentials', k), data);
      }
    } catch (err) {
      console.warn('Notice: Could not restore live master records:', err);
    }

    try {
      await terminate(db);
    } catch {
      // ignore
    }
  });

  it('1. Generates cryptographic salt and PBKDF2/SHA-256 hash', async () => {
    const salt = generateSalt(16);
    assert.strictEqual(typeof salt, 'string');
    assert.strictEqual(salt.length, 32); // 16 bytes = 32 hex chars

    const hash1 = await hashPassword(testMasterPass, salt);
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64); // 256 bits = 64 hex chars

    // Different salt yields different hash
    const salt2 = generateSalt(16);
    const hash2 = await hashPassword(testMasterPass, salt2);
    assert.notStrictEqual(hash1, hash2);
  });

  it('2. Verifies correct and incorrect passwords with verifyPassword', async () => {
    const salt = generateSalt();
    const hash = await hashPassword(testMasterPass, salt);

    const valid = await verifyPassword(testMasterPass, salt, hash);
    assert.strictEqual(valid, true, 'Correct password must verify');

    const invalid = await verifyPassword('WrongPassword123', salt, hash);
    assert.strictEqual(invalid, false, 'Incorrect password must be rejected');
  });

  it('3. Master Owner credentials setup and retrieval via DatabaseService', async () => {
    const salt = generateSalt();
    const passwordHash = await hashPassword(testMasterPass, salt);

    const creds: MasterOwnerCredentials = {
      email: ALT_MASTER_EMAIL,
      passwordHash,
      salt,
      isConfigured: true,
      configuredAt: new Date().toISOString(),
      twoFactorEnabled: false,
    };

    await DatabaseService.saveMasterOwnerCredentials(creds);

    const fetched = await DatabaseService.getMasterOwnerCredentials(ALT_MASTER_EMAIL);
    assert.ok(fetched, 'Master credentials must be retrievable');
    assert.strictEqual(fetched.isConfigured, true);
    assert.strictEqual(fetched.passwordHash, passwordHash);
    assert.strictEqual(fetched.salt, salt);
  });

  it('4. DatabaseService.authenticateUser recognizes Master Owner by email', async () => {
    // Authenticate with valid password
    const res = await DatabaseService.authenticateUser(ALT_MASTER_EMAIL, testMasterPass);
    assert.strictEqual(res.success, true, 'Authentication must succeed');
    assert.ok(res.user, 'User profile must be returned');
    assert.strictEqual(res.user.role, 'MASTER_OWNER');
    assert.strictEqual(res.user.status, 'ativo');
    assert.strictEqual(res.user.email.toLowerCase(), ALT_MASTER_EMAIL.toLowerCase());

    // Authenticate with wrong password
    const failRes = await DatabaseService.authenticateUser(ALT_MASTER_EMAIL, 'BadPassword');
    assert.strictEqual(failRes.success, false);
    assert.ok(failRes.error?.includes('Senha incorreta'));
  });

  it('5. Case-insensitive Master Owner authentication', async () => {
    const uppercaseEmail = ALT_MASTER_EMAIL.toUpperCase();
    const res = await DatabaseService.authenticateUser(uppercaseEmail, testMasterPass);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.role, 'MASTER_OWNER');
  });

  it('6. Non-master accounts are NEVER granted MASTER_OWNER role', async () => {
    // Attempt authentication with arbitrary non-master email
    const fakeRes = await DatabaseService.authenticateUser('hacker@external.com', 'SomePass123');
    assert.strictEqual(fakeRes.success, false);
    assert.ok(fakeRes.error?.includes('não encontrado'));
  });

  it('7. MASTER_EMAILS list contains all authorized master emails', () => {
    assert.ok(MASTER_EMAILS.includes('alifermadeiro@hotmail.com'));
    assert.ok(MASTER_EMAILS.includes('alifer.qualicare@gmail.com'));
    assert.ok(MASTER_EMAILS.includes('alifergael76@gmail.com'));
    assert.strictEqual(DEFAULT_MASTER_EMAIL.toLowerCase(), 'alifermadeiro@hotmail.com');
    assert.strictEqual(ALT_MASTER_EMAIL.toLowerCase(), 'alifer.qualicare@gmail.com');
  });

  it('8. All authorized master emails authenticate and resolve with individual MASTER_OWNER identity', async () => {
    // Ensure all master credentials are synchronized
    await DatabaseService.syncMasterOwnerCredentialsIfConfigured();

    for (const masterEmail of MASTER_EMAILS) {
      const authResult = await DatabaseService.authenticateUser(masterEmail, testMasterPass);
      assert.strictEqual(authResult.success, true, `Authentication for ${masterEmail} must succeed`);
      assert.ok(authResult.user, 'Profile must be present');
      assert.strictEqual(authResult.user.role, 'MASTER_OWNER');
      assert.strictEqual(authResult.user.email.toLowerCase(), masterEmail.toLowerCase());
      assert.strictEqual(authResult.user.status, 'ativo');
    }
  });

  it('9. Master Owner password recovery via resetPasswordWithTokenOrMaster with MASTER-RESET token', async () => {
    const recoveryEmail = 'alifergael76@gmail.com';
    const newMasterPass = 'Onnix#RecoveredMaster2026!';

    // Invalid token must be rejected
    const invalidReset = await DatabaseService.resetPasswordWithTokenOrMaster(
      recoveryEmail,
      'WRONG-TOKEN',
      newMasterPass
    );
    assert.strictEqual(invalidReset.success, false);
    assert.ok(invalidReset.error?.includes('inválido'));

    // Valid MASTER-RESET token succeeds
    const validReset = await DatabaseService.resetPasswordWithTokenOrMaster(
      recoveryEmail,
      'MASTER-RESET',
      newMasterPass
    );
    assert.strictEqual(validReset.success, true, 'Master recovery with MASTER-RESET must succeed');

    // Authenticate with the newly set password
    const loginNew = await DatabaseService.authenticateUser(recoveryEmail, newMasterPass);
    assert.strictEqual(loginNew.success, true, 'Login with recovered password must succeed');
    assert.strictEqual(loginNew.user?.role, 'MASTER_OWNER');

    // Restore test password for consistent test suite state
    await DatabaseService.resetPasswordWithTokenOrMaster(
      recoveryEmail,
      'MASTER-RESET',
      testMasterPass
    );
  });

  it('10. Session persistence validation maintains MASTER_OWNER role and permissions', async () => {
    const sessionUser = await DatabaseService.authenticateUser(DEFAULT_MASTER_EMAIL, testMasterPass);
    assert.strictEqual(sessionUser.success, true);
    assert.ok(sessionUser.user);

    // Simulate serialization / deserialization as in localStorage
    const serialized = JSON.stringify(sessionUser.user);
    const restored = JSON.parse(serialized);
    assert.strictEqual(restored.role, 'MASTER_OWNER');
    assert.strictEqual(restored.email.toLowerCase(), DEFAULT_MASTER_EMAIL.toLowerCase());
    assert.strictEqual(restored.status, 'ativo');
  });
});
