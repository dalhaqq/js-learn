/**
 * @file Tests for OutputVerifier — whitespace-tolerant output comparison.
 *
 * No VS Code dependency — pure Node.js with Mocha TDD + node:assert.
 */

import * as assert from 'assert';
import { Exercise, VerificationResult } from '../../types';
import { OutputVerifier } from '../../verifiers/OutputVerifier';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Build a minimal Exercise fixture for OutputVerifier testing.
 * Only `verification.expectedOutput` is varied — all other fields
 * use reasonable defaults that satisfy the type contract.
 */
function makeExercise(expectedOutput: string): Exercise {
  return {
    id: 'test-output-exercise',
    type: 'write',
    title: 'Test Exercise',
    description: 'Exercise for testing OutputVerifier',
    difficulty: 'easy',
    topic: 'basics',
    prerequisites: [],
    starterCode: '// tulis kode di sini',
    solution: '// solusi',
    verification: {
      mode: 'output',
      expectedOutput,
    },
    hints: [],
  };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

suite('OutputVerifier Test Suite', () => {
  let verifier: OutputVerifier;

  setup(() => {
    verifier = new OutputVerifier();
  });

  // ── Exact match ─────────────────────────────

  test('exact match: identical output passes', () => {
    const exercise = makeExercise('42');
    const result = verifier.verify(exercise, '42');

    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.message, 'Berhasil! Output sesuai.');
    assert.strictEqual(result.details, undefined);
  });

  // ── Whitespace tolerance (trim) ─────────────

  test('whitespace tolerance: leading/trailing whitespace is ignored', () => {
    const exercise = makeExercise('42');
    const result = verifier.verify(exercise, '  42  ');

    assert.strictEqual(result.passed, true, 'should pass after trim');
  });

  test('whitespace tolerance: tabs and spaces are trimmed', () => {
    const exercise = makeExercise('halo');
    const result = verifier.verify(exercise, '\t  halo\t\n');

    assert.strictEqual(result.passed, true, 'should pass after trim of tabs, spaces, and newlines');
  });

  // ── Line ending tolerance ───────────────────

  test('line ending tolerance: CRLF normalized to LF', () => {
    const exercise = makeExercise('a\nb');
    const result = verifier.verify(exercise, 'a\r\nb');

    assert.strictEqual(result.passed, true, 'should pass despite CRLF');
  });

  test('line ending tolerance: mixed line endings normalized', () => {
    const exercise = makeExercise('baris1\nbaris2\nbaris3');
    const result = verifier.verify(exercise, 'baris1\r\nbaris2\nbaris3');

    assert.strictEqual(result.passed, true, 'should pass with mixed line endings');
  });

  // ── Wrong output ────────────────────────────

  test('wrong output: different content fails with details', () => {
    const exercise = makeExercise('42');
    const result = verifier.verify(exercise, '43');

    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.message, 'Hasil tidak sesuai.');
    assert.ok(
      result.details !== undefined && result.details.includes('Diharapkan'),
      'details should contain "Diharapkan"'
    );
    assert.ok(
      result.details !== undefined && result.details.includes('Didapatkan'),
      'details should contain "Didapatkan"'
    );
  });

  test('wrong output: details show expected and actual output', () => {
    const exercise = makeExercise('halo dunia');
    const result = verifier.verify(exercise, 'hai dunia');

    assert.ok(
      result.details !== undefined && result.details.includes('halo dunia'),
      'details should include the expected output'
    );
    assert.ok(
      result.details !== undefined && result.details.includes('hai dunia'),
      'details should include the actual output'
    );
  });

  // ── Empty output ────────────────────────────

  test('empty output: empty string fails when expected is non-empty', () => {
    const exercise = makeExercise('halo');
    const result = verifier.verify(exercise, '');

    assert.strictEqual(result.passed, false);
  });

  test('empty expected: non-empty output fails', () => {
    const exercise = makeExercise('');
    const result = verifier.verify(exercise, 'something');

    assert.strictEqual(result.passed, false);
  });

  test('empty both: empty expected and empty output passes', () => {
    const exercise = makeExercise('');
    const result = verifier.verify(exercise, '');

    assert.strictEqual(result.passed, true);
  });

  // ── Multiple blank lines normalized ─────────

  test('blank lines: 3+ consecutive blank lines collapsed to 2', () => {
    const exercise = makeExercise('a\n\n\nb');
    const result = verifier.verify(exercise, 'a\n\nb');

    assert.strictEqual(result.passed, true, '3 blank lines should match 2');
  });

  test('blank lines: many consecutive blank lines normalized', () => {
    const exercise = makeExercise('atas\n\n\n\n\nbawah');
    const result = verifier.verify(exercise, 'atas\n\nbawah');

    assert.strictEqual(result.passed, true, '5 blank lines should match 2');
  });

  // ── Trailing whitespace per line ────────────

  test('trailing whitespace per line is stripped', () => {
    const exercise = makeExercise('foo\nbar');
    const result = verifier.verify(exercise, 'foo   \nbar\t ');

    assert.strictEqual(result.passed, true, 'should pass after stripping trailing whitespace per line');
  });

  // ── Multi-line combined tolerance ───────────

  test('multi-line: CRLF + trailing spaces + blank lines combined', () => {
    const exercise = makeExercise('satu\n\ndua');
    const result = verifier.verify(exercise, 'satu  \r\n\r\n\r\ndua\t');

    assert.strictEqual(result.passed, true, 'should handle combined whitespace differences');
  });

  // ── Undefined expectedOutput ────────────────

  test('undefined expectedOutput: treated as empty string', () => {
    const exercise: Exercise = {
      id: 'test-no-output',
      type: 'write',
      title: 'No Output Exercise',
      description: 'Exercise without expectedOutput',
      difficulty: 'easy',
      topic: 'basics',
      prerequisites: [],
      starterCode: '',
      solution: '',
      verification: {
        mode: 'output',
        // expectedOutput intentionally omitted
      },
      hints: [],
    };

    const result = verifier.verify(exercise, 'something');
    assert.strictEqual(result.passed, false);
  });
});
