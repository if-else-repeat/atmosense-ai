import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const rulesPath = resolve(currentDir, './firestore.rules');
const rules = readFileSync(rulesPath, 'utf8');

describe('Firestore Security Rules Invariants', () => {
  it('enforces per-user data isolation and forbids blanket /users listing', () => {
    expect(rules).toContain('request.auth.uid == userId');
    expect(rules).toContain('allow list: if false');
  });

  it('requires verified email identity and bounded key sizes on user writes', () => {
    expect(rules).toContain('request.auth.token.email_verified == true');
    expect(rules).toContain('hasValidSize(');
  });

  it('enforces append-only integrity on stored AI advisories', () => {
    expect(rules).toContain('match /advisories/{advisoryId}');
    expect(rules).toContain('allow update: if false');
  });

  it('allows public read and bounded authenticated writes on community documents', () => {
    expect(rules).toContain('allow read: if true');
    expect(rules).toContain('allow write: if request.auth != null');
    expect(rules).toContain('description.size() <= 500');
  });

  it('denies all unmatched paths by default', () => {
    expect(rules).toContain('allow read, write: if false');
  });
});
