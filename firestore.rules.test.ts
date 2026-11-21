import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const rulesPath = resolve(currentDir, './firestore.rules');
const rules = readFileSync(rulesPath, 'utf8');

describe('Firestore Security Rules', () => {
  it('should enforce per-user data isolation', () => {
    expect(rules).toContain('request.auth.uid == userId');
  });

  it('should deny access by default', () => {
    expect(rules).toContain('allow read, write: if false');
  });

  it('should allow public read access to community data', () => {
    expect(rules).toContain('allow read: if true');
  });

  it('should require authentication for community writes', () => {
    expect(rules).toContain('allow write: if request.auth != null');
  });
});
