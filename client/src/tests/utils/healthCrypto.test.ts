import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptHealthPayload,
  encryptHealthPayload,
  eraseLocalEncryptedVault,
  loadLocalEncryptedVault,
  saveLocalEncryptedVault,
  type LocalHealthVaultPayload,
} from '../../utils/healthCrypto';

afterEach(() => {
  window.localStorage.clear();
});

describe('healthCrypto — Client-Side AES-256-GCM Family Vault Encryption', () => {
  it('encrypts and decrypts payloads with unique random IVs per invocation', async () => {
    const record = { name: 'Aanya', conditions: ['asthma'], notes: 'Mild morning wheezing' };
    const first = await encryptHealthPayload('vault-a', record);
    const second = await encryptHealthPayload('vault-a', record);

    expect(first.keyVersion).toBe(1);
    expect(first.iv).not.toBe(second.iv);
    expect(first.encryptedPayload).not.toBe(second.encryptedPayload);
    expect(first.encryptedPayload).not.toContain('Aanya');

    const decrypted = await decryptHealthPayload<typeof record>('vault-a', first);
    expect(decrypted).toEqual(record);
  });

  it('rejects decryption with a mismatched vault scope/key or tampered ciphertext', async () => {
    const secret = { memberId: 'm-1', medication: 'budesonide' };
    const encrypted = await encryptHealthPayload('scope-alpha', secret);

    const wrongScope = await decryptHealthPayload<typeof secret>('scope-beta', encrypted);
    expect(wrongScope).toBeNull();

    const tamperedPayload =
      encrypted.encryptedPayload.slice(0, -4) +
      (encrypted.encryptedPayload.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    const tampered = await decryptHealthPayload<typeof secret>('scope-alpha', {
      encryptedPayload: tamperedPayload,
      iv: encrypted.iv,
    });
    expect(tampered).toBeNull();
  });

  it('saves, reloads, and GDPR-erases the encrypted local vault cleanly', async () => {
    const vault: LocalHealthVaultPayload = {
      members: [
        {
          id: 'mem-1',
          name: 'Meera',
          age: 9,
          relationship: 'Child',
          healthConditions: ['asthma'],
          sensitivityLevel: 'high',
          activityPatterns: ['school'],
          avatarColor: '#0E7490',
          createdAt: 1_760_000_000_000,
        },
      ],
      symptomLogs: [
        {
          id: 'log-1',
          memberId: 'mem-1',
          timestamp: 1_760_000_000_000,
          aqiAtLog: 155,
          locationName: 'New Delhi',
          coughing: 'mild',
          wheezing: 'none',
          eyeIrritation: 'mild',
          shortnessOfBreath: 'none',
          headache: 'none',
        },
      ],
      aiConsent: true,
    };

    await saveLocalEncryptedVault(vault);
    const rawStored = window.localStorage.getItem('atmosense-family-vault-v1') ?? '';
    expect(rawStored).not.toContain('Meera');

    const loaded = await loadLocalEncryptedVault();
    expect(loaded).toEqual(vault);

    eraseLocalEncryptedVault();
    expect(await loadLocalEncryptedVault()).toBeNull();
  });
});
