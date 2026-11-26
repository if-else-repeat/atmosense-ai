import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CLIENT_SRC = path.join(REPO_ROOT, 'client/src');
const SERVER_SRC = path.join(REPO_ROOT, 'server/src');
const ROUTES_DIR = path.join(SERVER_SRC, 'routes');
const SERVER_LIB_DIR = path.join(SERVER_SRC, 'lib');

function collectProductionSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'tests' || entry === 'test' || entry === '__tests__') continue;
      results.push(...collectProductionSourceFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx') &&
      !entry.endsWith('.vitest.ts') &&
      !entry.endsWith('.vitest.tsx') &&
      !entry.endsWith('.d.ts')
    ) {
      results.push(full);
    }
  }
  return results;
}

describe('Architecture & Code Quality Conventions Gate', () => {
  const clientFiles = collectProductionSourceFiles(CLIENT_SRC);
  const serverFiles = collectProductionSourceFiles(SERVER_SRC);
  const allProductionFiles = [...clientFiles, ...serverFiles];

  it('enforces single-responsibility file size cap (<= 300 lines, target <= 260 lines) across all production files', () => {
    const violations: string[] = [];
    for (const file of allProductionFiles) {
      const lines = readFileSync(file, 'utf8').split('\n').length;
      if (lines > 300) {
        violations.push(`${path.relative(REPO_ROOT, file)}: ${lines} lines`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('prohibits unsafe dynamic execution, raw HTML injection, and explicit any types', () => {
    const forbidden: ReadonlyArray<{ label: string; regex: RegExp }> = [
      { label: 'dangerouslySetInnerHTML', regex: /\bdangerouslySetInnerHTML\b/ },
      { label: 'eval(', regex: /\beval\s*\(/ },
      { label: 'new Function(', regex: /\bnew\s+Function\s*\(/ },
      { label: ': any', regex: /:\s*any\b/ },
      { label: 'as any', regex: /\bas\s+any\b/ },
    ];

    const violations: string[] = [];
    for (const file of allProductionFiles) {
      const content = readFileSync(file, 'utf8');
      for (const rule of forbidden) {
        if (rule.regex.test(content)) {
          violations.push(`${path.relative(REPO_ROOT, file)} contains ${rule.label}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('enforces clean architectural layer boundaries between client, server/lib, and server/routes', () => {
    const boundaryViolations: string[] = [];

    for (const file of clientFiles) {
      const content = readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*(?:^|\/)server\//.test(content)) {
        boundaryViolations.push(`${path.relative(REPO_ROOT, file)} imports from server/`);
      }
    }

    for (const file of collectProductionSourceFiles(SERVER_LIB_DIR)) {
      const content = readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*routes\//.test(content)) {
        boundaryViolations.push(
          `${path.relative(REPO_ROOT, file)} imports from server/src/routes/`,
        );
      }
    }

    expect(boundaryViolations).toEqual([]);
  });

  it('verifies every Express route module under server/src/routes/ enforces Zod validation and rate limiting', () => {
    const routeFiles = readdirSync(ROUTES_DIR)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('Schemas.ts'))
      .map((f) => path.join(ROUTES_DIR, f));

    expect(routeFiles.length).toBeGreaterThanOrEqual(3);

    for (const routeFile of routeFiles) {
      const content = readFileSync(routeFile, 'utf8');
      const usesZod = /\b(?:zod|safeParse|Schema)\b/.test(content);
      const usesRateLimit = /(?:RateLimiter|rateLimit)/i.test(content);
      expect(usesZod, `${path.basename(routeFile)} must validate inputs with Zod`).toBe(true);
      expect(usesRateLimit, `${path.basename(routeFile)} must apply rate limiting`).toBe(true);
    }
  });
});
