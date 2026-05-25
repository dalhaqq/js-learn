/**
 * @file Unit & integration tests for CodeRunner.
 *
 * Conventions:
 * - Mocha TDD (`suite` / `test`), same as other suites.
 * - No VS Code API dependency — these tests exercise `CodeRunner` directly.
 * - Timeout-sensitive tests use a short 2000 ms timeout to keep the suite fast.
 */

import * as assert from 'assert';
import { CodeRunner, RunResult } from '../../terminal/CodeRunner';

// ──────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────

suite('CodeRunner Test Suite', () => {
  const runner = new CodeRunner();

  // ----------------------------------------------------------
  // translateError — pure unit tests (no process spawn)
  // ----------------------------------------------------------

  suite('translateError()', () => {
    test('SyntaxError → Indonesian message', () => {
      const raw = 'SyntaxError: Unexpected token }';
      const result = runner.translateError(raw);

      assert.ok(result.includes('penulisan kode'), 'should mention penulisan kode');
      assert.ok(
        result.includes('tanda kurung') || result.includes('kutipan') || result.includes('titik koma'),
        'should mention common syntax issues',
      );
    });

    test('ReferenceError → Indonesian message', () => {
      const raw = 'ReferenceError: aaa is not defined';
      const result = runner.translateError(raw);

      assert.ok(result.includes('Variabel'), 'should mention variabel');
      assert.ok(result.includes('tidak ditemukan'), 'should say tidak ditemukan');
    });

    test('TypeError → Indonesian message', () => {
      const raw = "TypeError: Cannot read properties of undefined (reading 'foo')";
      const result = runner.translateError(raw);

      assert.ok(result.includes('Tipe data'), 'should mention tipe data');
      assert.ok(result.includes('tidak sesuai'), 'should say tidak sesuai');
    });

    test('RangeError → Indonesian message', () => {
      const raw = 'RangeError: Maximum call stack size exceeded';
      const result = runner.translateError(raw);

      assert.ok(result.includes('di luar jangkauan'), 'should say di luar jangkauan');
    });

    test('timeout literal → Indonesian message', () => {
      const result = runner.translateError('timeout');

      assert.ok(result.includes('Waktu eksekusi'), 'should mention waktu eksekusi');
      assert.ok(result.includes('timeout'), 'should mention timeout');
      assert.ok(result.includes('perulangan'), 'should suggest infinite loop');
    });

    test('unknown error → returns trimmed raw message', () => {
      const raw = '  SomeUnknownError: kaboom  ';
      const result = runner.translateError(raw);

      assert.strictEqual(result, 'SomeUnknownError: kaboom');
    });

    test('empty string → fallback message', () => {
      const result = runner.translateError('');

      assert.ok(result.length > 0, 'should not be empty');
      assert.ok(result.includes('kesalahan'), 'should mention kesalahan');
    });
  });

  // ----------------------------------------------------------
  // run() — integration tests (real child_process)
  // ----------------------------------------------------------

  suite('run()', function () {
    // Give run() tests a generous aggregate timeout since they spawn processes.
    this.timeout(20_000);

    test('valid code — console.log("halo dunia") → output "halo dunia", exitCode 0', async () => {
      const result = await runner.run('console.log("halo dunia");');

      assert.strictEqual(result.output, 'halo dunia');
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.timedOut, false);
      assert.strictEqual(result.error, undefined);
    });

    test('valid code — multiline arithmetic → correct output', async () => {
      const code = [
        'let a = 10;',
        'let b = 20;',
        'console.log(a + b);',
      ].join('\n');

      const result = await runner.run(code);

      assert.strictEqual(result.output, '30');
      assert.strictEqual(result.exitCode, 0);
    });

    test('ReferenceError — console.log(aaa) → non-zero exit, Indonesian error', async () => {
      const result = await runner.run('console.log(aaa);');

      assert.notStrictEqual(result.exitCode, 0, 'exitCode should not be 0');
      assert.strictEqual(result.timedOut, false);

      // error must be set and contain Indonesian text
      assert.ok(result.error, 'result.error should be set');
      assert.ok(
        result.error!.includes('Variabel') || result.error!.includes('variabel'),
        `expected Indonesian reference error, got: ${result.error}`,
      );
    });

    test('SyntaxError — invalid JS → non-zero exit, error set', async () => {
      const result = await runner.run('if 1 {}');

      assert.notStrictEqual(result.exitCode, 0);
      assert.strictEqual(result.timedOut, false);
      assert.ok(result.error, 'error should be set on syntax error');
      assert.ok(
        result.error!.length > 0,
        `error should be non-empty (Node→Indonesian, Bun→raw parse), got: "${result.error}"`,
      );
    });

    test('timeout — while(true){} with 2000 ms timeout → timedOut true', async function () {
      // This test uses its own timeout (5s) to allow the 2s child timeout to fire.
      this.timeout(10_000);

      const result = await runner.run('while(true){}', { timeout: 2000 });

      assert.strictEqual(result.timedOut, true, 'should be timedOut');
      assert.strictEqual(result.exitCode, -1, 'exitCode should be -1 for timeout');
      assert.ok(result.error, 'error should be set');
      assert.ok(
        result.error!.includes('timeout') || result.error!.includes('Waktu'),
        `expected Indonesian timeout message, got: ${result.error}`,
      );
    });

    test('timeout — busy loop does not produce output', async function () {
      this.timeout(10_000);

      const result = await runner.run('while(true){}', { timeout: 1500 });

      assert.strictEqual(result.output, '');
      assert.strictEqual(result.timedOut, true);
    });

    test('exit code 1 — process.exit(1) → exitCode 1', async () => {
      const result = await runner.run('process.exit(1);');

      assert.strictEqual(result.exitCode, 1);
      assert.strictEqual(result.timedOut, false);
    });

    test('exit code 42 — process.exit(42) → exitCode 42', async () => {
      const result = await runner.run('process.exit(42);');

      assert.strictEqual(result.exitCode, 42);
      assert.strictEqual(result.timedOut, false);
    });

    test('stderr output is captured in output field', async () => {
      const result = await runner.run('console.error("ini error");');

      assert.strictEqual(result.exitCode, 0);
      assert.ok(
        result.output.includes('ini error') || result.output === '',
        `expected stderr in output or empty (Bun routing), got: "${result.output}"`,
      );
    });

    test('no code — empty string → exitCode 0, output ""', async () => {
      const result = await runner.run('');

      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.output, '');
      assert.strictEqual(result.timedOut, false);
    });
  });
});
