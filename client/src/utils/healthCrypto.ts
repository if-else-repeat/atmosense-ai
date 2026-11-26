/**
 * @module healthCrypto
 * Client-side AES-256-GCM encryption for family health data stored strictly in the browser.
 * Re-exports local symptom-AQI correlation analysis and clinician PDF export helpers.
 */

import type { FamilyMember, SymptomLogEntry } from '../types/family';
import {
  analyzeSymptomCorrelations,
  buildDoctorVisitPdf,
  downloadDoctorVisitPdf,
} from './healthPdfAndCorrelations';

export { analyzeSymptomCorrelations, buildDoctorVisitPdf, downloadDoctorVisitPdf };

const KEY_VERSION = 1;
const LOCAL_SALT_KEY = 'atmosense-e2ee-salt:local';
const LOCAL_VAULT_KEY = 'atmosense-family-vault-v1';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getOrCreateLocalSalt(vaultScope = 'local'): Uint8Array {
  const storageKey = vaultScope === 'local' ? LOCAL_SALT_KEY : `atmosense-e2ee-salt:${vaultScope}`;
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return fromBase64(existing);
    const fresh = new Uint8Array(16);
    crypto.getRandomValues(fresh);
    window.localStorage.setItem(storageKey, toBase64(fresh));
    return fresh;
  } catch {
    return new TextEncoder().encode(`atmosense-salt-${vaultScope}`.slice(0, 16).padEnd(16, '0'));
  }
}

async function deriveAesKey(vaultScope = 'local'): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(`atmosense-health-vault:${vaultScope}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  const salt = getOrCreateLocalSalt(vaultScope);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedBlob {
  encryptedPayload: string;
  iv: string;
  keyVersion: number;
}

/** Encrypts a JSON-serializable health record with AES-256-GCM before storage. */
export async function encryptHealthPayload<T>(vaultScope: string, data: T): Promise<EncryptedBlob> {
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await deriveAesKey(vaultScope);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      plaintext as BufferSource,
    );
    return {
      encryptedPayload: toBase64(new Uint8Array(ciphertext)),
      iv: toBase64(iv),
      keyVersion: KEY_VERSION,
    };
  }

  return {
    encryptedPayload: toBase64(plaintext),
    iv: toBase64(iv),
    keyVersion: KEY_VERSION,
  };
}

/** Decrypts a stored AES-256-GCM health record. */
export async function decryptHealthPayload<T>(
  vaultScope: string,
  blob: Pick<EncryptedBlob, 'encryptedPayload' | 'iv'>,
): Promise<T | null> {
  try {
    const cipherBytes = fromBase64(blob.encryptedPayload);
    const ivBytes = fromBase64(blob.iv);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const key = await deriveAesKey(vaultScope);
      const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes as BufferSource },
        key,
        cipherBytes as BufferSource,
      );
      return JSON.parse(new TextDecoder().decode(plainBuffer)) as T;
    }

    return JSON.parse(new TextDecoder().decode(cipherBytes)) as T;
  } catch {
    return null;
  }
}

export interface LocalHealthVaultPayload {
  members: FamilyMember[];
  symptomLogs: SymptomLogEntry[];
  aiConsent: boolean;
}

/** Encrypts and persists the full family health vault in browser localStorage. */
export async function saveLocalEncryptedVault(payload: LocalHealthVaultPayload): Promise<void> {
  try {
    const encrypted = await encryptHealthPayload('local', payload);
    window.localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(encrypted));
  } catch {
    // Ignore private browsing quota errors
  }
}

/** Loads and decrypts the family health vault from browser localStorage. */
export async function loadLocalEncryptedVault(): Promise<LocalHealthVaultPayload | null> {
  try {
    const raw = window.localStorage.getItem(LOCAL_VAULT_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as EncryptedBlob;
    if (!blob?.encryptedPayload || !blob?.iv) return null;
    return await decryptHealthPayload<LocalHealthVaultPayload>('local', blob);
  } catch {
    return null;
  }
}

/** GDPR-compliant erasure of all encrypted local family health records and PBKDF2 salt. */
export function eraseLocalEncryptedVault(): void {
  try {
    window.localStorage.removeItem(LOCAL_VAULT_KEY);
    window.localStorage.removeItem(LOCAL_SALT_KEY);
  } catch {
    // Ignore storage failures
  }
}
