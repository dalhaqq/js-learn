import * as assert from 'assert';
import { Exercise, VerificationResult } from '../../types';
import { TestVerifier, CodeRunnerLike, RunResult } from '../../verifiers/TestVerifier';

// ──────────────────────────────────────────────
// Mock CodeRunner — returns the output we tell it to
// ──────────────────────────────────────────────

class MockCodeRunner implements CodeRunnerLike {
  /** Pre-configured output to return from `run()`. */
  private nextOutput = '';
  private nextExitCode = 0;
  private nextTimedOut = false;

  setOutput(output: string): void {
    this.nextOutput = output;
    this.nextExitCode = 0;
    this.nextTimedOut = false;
  }

  setTimedOut(): void {
    this.nextTimedOut = true;
    this.nextOutput = '';
    this.nextExitCode = 124;
  }

  async run(_code: string, _options?: { timeout?: number }): Promise<RunResult> {
    return {
      output: this.nextOutput,
      exitCode: this.nextExitCode,
      timedOut: this.nextTimedOut,
    };
  }
}

// ──────────────────────────────────────────────
// Helper — build a minimal Exercise for testing
// ──────────────────────────────────────────────

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-001',
    type: 'write',
    title: 'Test Exercise',
    description: 'Exercise for testing TestVerifier',
    difficulty: 'easy',
    topic: 'basics',
    prerequisites: [],
    starterCode: '',
    solution: '',
    verification: {
      mode: 'test',
      testCode: undefined,
    },
    hints: [],
    ...overrides,
  } as Exercise;
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

suite('TestVerifier Test Suite', () => {
  let runner: MockCodeRunner;
  let verifier: TestVerifier;

  setup(() => {
    runner = new MockCodeRunner();
    verifier = new TestVerifier(runner);
  });

  // ── No testCode ──────────────────────────────

  test('verify() returns passed when exercise has no testCode', async () => {
    const exercise = makeExercise({
      verification: { mode: 'test', testCode: '' },
    });

    const result = await verifier.verify(exercise, 'const x = 1;');

    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.message, 'Latihan ini tidak memerlukan tes.');
    assert.strictEqual(result.details, undefined);
  });

  test('verify() returns passed when verification.testCode is undefined', async () => {
    const exercise = makeExercise({
      verification: { mode: 'test' },
    });

    const result = await verifier.verify(exercise, 'const x = 1;');

    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.message, 'Latihan ini tidak memerlukan tes.');
  });

  // ── All assertions pass ──────────────────────

  test('verify() reports success when all assertions pass', async () => {
    // The wrapped code prints __ALL_ASSERTIONS_PASSED__ on success
    runner.setOutput('__ALL_ASSERTIONS_PASSED__\n');

    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: 'assert(typeof hasil === "number", "Fungsi harus mengembalikan angka");',
      },
    });

    const result = await verifier.verify(exercise, 'const hasil = 42;');

    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.message, 'Berhasil! Semua tes lulus.');
    assert.strictEqual(result.details, undefined);
  });

  // ── One assertion fails ──────────────────────

  test('verify() reports failure with assertion details when one assertion fails', async () => {
    runner.setOutput('__ASSERT_FAILED__:Tes 1 gagal: Fungsi harus mengembalikan angka\n');

    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: 'assert(typeof hasil === "number", "Fungsi harus mengembalikan angka");',
      },
    });

    const result = await verifier.verify(exercise, 'const hasil = "bukan angka";');

    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.message, 'Tes gagal.');
    assert.ok(
      result.details!.includes('Tes 1 gagal: Fungsi harus mengembalikan angka'),
      `Expected details to contain "Tes 1 gagal", got: ${result.details}`
    );
  });

  // ── Multiple assertions — first failure wins ──

  test('verify() reports only the first failing assertion when multiple assertions exist', async () => {
    // Only the first failure is reported because the sandbox throws on assert fail
    runner.setOutput('__ASSERT_FAILED__:Tes 2 gagal: Hasil harus lebih dari 10\n');

    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: [
          'assert(typeof hasil === "number", "Fungsi harus mengembalikan angka");',
          'assert(hasil > 10, "Hasil harus lebih dari 10");',
          'assert(hasil < 100, "Hasil harus kurang dari 100");',
        ].join('\n'),
      },
    });

    const result = await verifier.verify(exercise, 'const hasil = 5;');

    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.message, 'Tes gagal.');
    assert.ok(
      result.details!.includes('Tes 2 gagal: Hasil harus lebih dari 10'),
      `Expected details to contain "Tes 2 gagal", got: ${result.details}`
    );
    // Should NOT contain the third assertion
    assert.ok(
      !result.details!.includes('Tes 3'),
      `Expected details NOT to contain "Tes 3", got: ${result.details}`
    );
  });

  // ── Timeout ──────────────────────────────────

  test('verify() reports timeout when code runs too long', async () => {
    runner.setTimedOut();

    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: 'while(true) {}',
      },
    });

    const result = await verifier.verify(exercise, 'const x = 1;');

    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.message, 'Kode berjalan terlalu lama dan dihentikan.');
    assert.strictEqual(result.details, undefined);
  });

  // ── Runtime error ────────────────────────────

  test('verify() reports runtime error when code throws', async () => {
    runner.setOutput('__RUNTIME_ERROR__:hasil is not defined\n');

    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: 'assert(typeof hasil === "number", "Harus angka");',
      },
    });

    const result = await verifier.verify(exercise, '');

    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.message, 'Kode mengalami kesalahan saat dijalankan.');
  });

  // ── Indonesian messages ──────────────────────

  test('verify() returns Indonesian success and failure messages', async () => {
    // Success case
    runner.setOutput('__ALL_ASSERTIONS_PASSED__\n');
    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: 'assert(true, "harus true");',
      },
    });

    const passResult = await verifier.verify(exercise, 'const x = 1;');
    assert.strictEqual(passResult.passed, true);
    assert.strictEqual(passResult.message, 'Berhasil! Semua tes lulus.');

    // Failure case
    runner.setOutput('__ASSERT_FAILED__:Tes 1 gagal: Nilai tidak sesuai\n');
    const failResult = await verifier.verify(exercise, 'const x = 1;');
    assert.strictEqual(failResult.passed, false);
    assert.strictEqual(failResult.message, 'Tes gagal.');
    assert.ok(failResult.details!.startsWith('Tes 1 gagal:'));
  });

  // ── First assertion passes, second fails ─────

  test('verify() correctly identifies failure when first assertion passes but later fails', async () => {
    // Sandbox throws on first failure, so we see the second assertion fail
    runner.setOutput('__ASSERT_FAILED__:Tes 2 gagal: Hasil harus positif\n');

    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: [
          'assert(typeof hasil === "number", "Fungsi harus mengembalikan angka");',
          'assert(hasil > 0, "Hasil harus positif");',
        ].join('\n'),
      },
    });

    const result = await verifier.verify(exercise, 'const hasil = -5;');

    assert.strictEqual(result.passed, false);
    assert.ok(result.details!.includes('Tes 2 gagal: Hasil harus positif'));
  });

  // ── Empty userCode with valid testCode ────────

  test('verify() handles empty user code gracefully', async () => {
    runner.setOutput('__RUNTIME_ERROR__:hasil is not defined\n');

    const exercise = makeExercise({
      verification: {
        mode: 'test',
        testCode: 'assert(typeof hasil !== "undefined", "Variabel hasil harus didefinisikan");',
      },
    });

    const result = await verifier.verify(exercise, '');

    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.message, 'Kode mengalami kesalahan saat dijalankan.');
  });
});
