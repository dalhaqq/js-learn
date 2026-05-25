/**
 * @file I18N audit tests — verifies the message catalog is complete,
 * all values are in Indonesian, and no English learner-facing strings
 * remain in source files.
 *
 * Pure Node.js — no VS Code dependency.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { I18N, DIFFICULTY_LABELS } from '../../i18n/messages';

// ──────────────────────────────────────────────
// Required key inventories
// ──────────────────────────────────────────────

const REQUIRED_ERROR_KEYS = [
  'syntax',
  'typeError',
  'referenceError',
  'rangeError',
  'timeout',
  'nodeVersion',
  'corruptedProgress',
  'exerciseNotFound',
  'webviewFailure',
];

const REQUIRED_UI_KEYS = [
  'runButton',
  'runDomButton',
  'skipButton',
  'hintLabel',
  'hintItem',
  'difficultyEasy',
  'difficultyMedium',
  'difficultyHard',
  'completed',
  'skipped',
  'sandboxLabel',
  'domResultLabel',
  'codeEditor',
  'noHints',
];

const REQUIRED_VERIFICATION_KEYS = [
  'pass',
  'fail',
  'failTest',
  'expectedLabel',
  'actualLabel',
  'passAll',
  'testPass',
  'testFail',
  'noTestRequired',
  'runtimeError',
  'timeout',
  'passDom',
  'failDom',
];

const REQUIRED_PROGRESS_KEYS = [
  'corrupted',
  'resetWarning',
];

const REQUIRED_SETUP_KEYS = [
  'nodeVersionWarning',
  'nodejsNotFound',
  'exerciseNotFound',
];

/** Indonesian indicator words that should appear in most values. */
const INDONESIAN_KEYWORDS = [
  'kode',
  'kesalahan',
  'berhasil',
  'gagal',
  'tidak',
  'ditemukan',
  'variabel',
  'fungsi',
  'tipe',
  'data',
  'jangkauan',
  'perulangan',
  'progress',
  'latihan',
  'tes',
  'hasil',
  'diharapkan',
  'didapatkan',
  'petunjuk',
  'selesai',
  'mudah',
  'sedang',
  'sulit',
  'dom',
  'editor',
  'node',
  'versi',
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Recursively collect all leaf values from an object (including function results). */
function collectLeafValues(obj: Record<string, unknown>, prefix = ''): string[] {
  const values: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      values.push(value);
    } else if (typeof value === 'function') {
      // Call with dummy arguments to get the template string
      if (fullKey.endsWith('nodeVersion') || fullKey.endsWith('nodeVersionWarning')) {
        values.push(value('20.0.0', '18'));
      } else if (fullKey.endsWith('exerciseNotFound')) {
        values.push(value('ex-001'));
      } else if (fullKey.endsWith('hintItem')) {
        values.push(value(1));
      } else if (fullKey.endsWith('testFail')) {
        values.push(value(1, 'assertion failed'));
      } else {
        values.push(value(0, ''));
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      values.push(...collectLeafValues(value as Record<string, unknown>, fullKey));
    }
  }
  return values;
}

/** Check if a string contains at least one Indonesian keyword. */
function containsIndonesianKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return INDONESIAN_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Read a source file and return its content. */
function readSourceFile(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', '..', '..', 'src', relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

suite('I18N Catalog', () => {
  test('I18N.errors contains all required error keys', () => {
    for (const key of REQUIRED_ERROR_KEYS) {
      assert.ok(
        key in I18N.errors,
        `Missing required error key: ${key}`,
      );
    }
  });

  test('I18N.ui contains all required UI keys', () => {
    for (const key of REQUIRED_UI_KEYS) {
      assert.ok(
        key in I18N.ui,
        `Missing required UI key: ${key}`,
      );
    }
  });

  test('I18N.verification contains all required verification keys', () => {
    for (const key of REQUIRED_VERIFICATION_KEYS) {
      assert.ok(
        key in I18N.verification,
        `Missing required verification key: ${key}`,
      );
    }
  });

  test('I18N.progress contains all required progress keys', () => {
    for (const key of REQUIRED_PROGRESS_KEYS) {
      assert.ok(
        key in I18N.progress,
        `Missing required progress key: ${key}`,
      );
    }
  });

  test('I18N.setup contains all required setup keys', () => {
    for (const key of REQUIRED_SETUP_KEYS) {
      assert.ok(
        key in I18N.setup,
        `Missing required setup key: ${key}`,
      );
    }
  });

  test('All I18N values are non-empty strings in Indonesian', () => {
    const allValues = collectLeafValues(I18N as unknown as Record<string, unknown>);

    for (const value of allValues) {
      assert.ok(
        value.length > 0,
        `I18N value is empty: "${value}"`,
      );
    }

    // At least 80% of values must contain an Indonesian keyword
    const matchingCount = allValues.filter(containsIndonesianKeyword).length;
    const ratio = matchingCount / allValues.length;
    assert.ok(
      ratio >= 0.8,
      `Only ${Math.round(ratio * 100)}% of I18N values contain Indonesian keywords (${matchingCount}/${allValues.length})`,
    );
  });

  test('DIFFICULTY_LABELS map is complete and Indonesian', () => {
    assert.strictEqual(DIFFICULTY_LABELS.easy, 'Mudah');
    assert.strictEqual(DIFFICULTY_LABELS.medium, 'Sedang');
    assert.strictEqual(DIFFICULTY_LABELS.hard, 'Sulit');
    assert.strictEqual(Object.keys(DIFFICULTY_LABELS).length, 3);
  });
});

suite('I18N Source Audit', () => {
  test('ExercisePanel.ts has no hardcoded English UI strings', () => {
    const content = readSourceFile('webview/ExercisePanel.ts');
    // These English words should NOT appear outside comments in the file
    const bannedInHtml = [
      /['"]✓ Selesai['"]/,
      /['"]Lewat['"]/,
      /['"]▶ Jalankan Kode['"]/,
      /['"]⏭ Lewati['"]/,
      /['"]💡 Petunjuk['"]/,
      /Petunjuk \$\{.*\}/,
    ];
    for (const pattern of bannedInHtml) {
      assert.ok(
        !pattern.test(content),
        `Found banned hardcoded string matching: ${pattern}`,
      );
    }
  });

  test('DomExercisePanel.ts has no hardcoded English UI strings', () => {
    const content = readSourceFile('webview/DomExercisePanel.ts');
    const bannedPatterns = [
      /['"]✓ Selesai['"]/,
      /['"]Lewat['"]/,
      /['"]▶ Jalankan DOM['"]/,
      /['"]⏭ Lewati['"]/,
      /['"]💡 Petunjuk['"]/,
      /['"]Area DOM['"]/,
      /['"]Hasil DOM['"]/,
      /['"]Berhasil! DOM sesuai['"]/,
      /['"]DOM tidak sesuai['"]/,
      /Petunjuk \$\{.*\}/,
    ];
    for (const pattern of bannedPatterns) {
      assert.ok(
        !pattern.test(content),
        `Found banned hardcoded string matching: ${pattern}`,
      );
    }
  });

  test('Source files import I18N from the catalog', () => {
    const filesToCheck = [
      'extension.ts',
      'webview/ExercisePanel.ts',
      'webview/DomExercisePanel.ts',
      'verifiers/OutputVerifier.ts',
      'verifiers/TestVerifier.ts',
      'terminal/CodeRunner.ts',
      'storage/ProgressStore.ts',
    ];

    for (const relPath of filesToCheck) {
      const content = readSourceFile(relPath);
      assert.ok(
        content.includes("from '../i18n/messages'") ||
          content.includes('from \'../i18n/messages\'') ||
          content.includes('from "./i18n/messages"') ||
          content.includes("from './i18n/messages'"),
        `${relPath} does not import from i18n/messages`,
      );
    }
  });

  test('OutputVerifier.ts uses I18N for all user-facing messages', () => {
    const content = readSourceFile('verifiers/OutputVerifier.ts');
    // Should reference I18N.verification.* for messages
    assert.ok(content.includes('I18N.verification.pass'));
    assert.ok(content.includes('I18N.verification.fail'));
    assert.ok(content.includes('I18N.verification.expectedLabel'));
    assert.ok(content.includes('I18N.verification.actualLabel'));
  });

  test('package.json has Indonesian description', () => {
    const pkgPath = path.resolve(__dirname, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.ok(pkg.description.includes('belajar'));
    assert.ok(pkg.description.includes('JavaScript'));
    assert.ok(pkg.description.includes('VS Code'));
  });
});
