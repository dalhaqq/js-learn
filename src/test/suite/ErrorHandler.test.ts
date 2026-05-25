/**
 * @file Unit tests for ErrorHandler — centralized Indonesian error messages.
 *
 * Conventions:
 * - Mocha TDD (`suite` / `test`), matching all other test suites.
 * - No VS Code API dependency — these are pure unit tests.
 * - Messages must contain Indonesian keywords AND never contain English
 *   technical error names.
 */

import * as assert from 'assert';
import { ErrorHandler } from '../../errors/ErrorHandler';

// ──────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────

suite('ErrorHandler Test Suite', () => {
  // ----------------------------------------------------------
  // handleError — auto-detect dispatcher
  // ----------------------------------------------------------

  suite('handleError()', () => {
    test('SyntaxError → Indonesian message, zero English', () => {
      const err = new SyntaxError('Unexpected token }');
      const msg = ErrorHandler.handleError(err);

      assert.ok(msg.includes('penulisan kode'), 'should mention penulisan kode');
      assert.ok(
        msg.includes('tanda kurung') ||
          msg.includes('kutipan') ||
          msg.includes('titik koma'),
        'should mention common syntax issues',
      );
      assert.ok(!msg.includes('SyntaxError'), 'should NOT contain SyntaxError');
      assert.ok(!msg.includes('Unexpected token'), 'should NOT contain raw error text');
    });

    test('TypeError → Indonesian message with tipe data context', () => {
      const err = new TypeError("Cannot read properties of undefined (reading 'foo')");
      const msg = ErrorHandler.handleError(err);

      assert.ok(msg.includes('kesalahan tipe data'), 'should mention tipe data');
      assert.ok(msg.includes('jenis data'), 'should mention jenis data');
      assert.ok(!msg.includes('TypeError'), 'should NOT contain TypeError');
      assert.ok(!msg.includes('Cannot read properties'), 'should NOT contain raw error text');
    });

    test('ReferenceError → Indonesian message mentioning variabel', () => {
      const err = new ReferenceError('x is not defined');
      const msg = ErrorHandler.handleError(err);

      assert.ok(msg.includes('variabel'), 'should mention variabel');
      assert.ok(msg.includes('belum didefinisikan'), 'should say belum didefinisikan');
      assert.ok(!msg.includes('ReferenceError'), 'should NOT contain ReferenceError');
      assert.ok(!msg.includes('is not defined'), 'should NOT contain raw error text');
    });

    test('RangeError → Indonesian message mentioning jangkauan', () => {
      const err = new RangeError('Maximum call stack size exceeded');
      const msg = ErrorHandler.handleError(err);

      assert.ok(msg.includes('jangkauan'), 'should mention jangkauan');
      assert.ok(
        msg.includes('angka') || msg.includes('indeks'),
        'should mention angka or indeks',
      );
      assert.ok(!msg.includes('RangeError'), 'should NOT contain RangeError');
      assert.ok(!msg.includes('call stack'), 'should NOT contain raw error text');
    });

    test('generic Error → fallback Indonesian message', () => {
      const err = new Error('Something went wrong');
      const msg = ErrorHandler.handleError(err);

      assert.ok(
        msg.includes('kesalahan') || msg.includes('Something went wrong'),
        'should use safe message',
      );
    });

    test('string error → passed through as-is', () => {
      const msg = ErrorHandler.handleError('Ada masalah jaringan.');
      assert.strictEqual(msg, 'Ada masalah jaringan.');
    });

    test('context parameter is passed through for version mismatch sentinel', () => {
      const msg = ErrorHandler.handleError('VERSION_MISMATCH', 'v16.20.0');
      assert.ok(msg.includes('Node.js'), 'should mention Node.js');
      assert.ok(msg.includes('v16.20.0'), 'should include the provided version');
    });
  });

  // ----------------------------------------------------------
  // Specific error-type handlers (direct call)
  // ----------------------------------------------------------

  suite('handleSyntaxError()', () => {
    test('returns Indonesian message about penulisan kode', () => {
      const msg = ErrorHandler.handleSyntaxError();
      assert.ok(msg.includes('penulisan kode'), 'should mention penulisan kode');
      assert.ok(!msg.includes('Syntax'), 'should NOT contain English Syntax');
    });
  });

  suite('handleRuntimeError()', () => {
    test('TypeError → tipe data message', () => {
      const msg = ErrorHandler.handleRuntimeError(
        new TypeError("Cannot read property 'x' of undefined"),
      );
      assert.ok(msg.includes('tipe data'), 'should mention tipe data');
      assert.ok(!msg.includes('TypeError'), 'should NOT contain TypeError');
    });

    test('ReferenceError → variabel message', () => {
      const msg = ErrorHandler.handleRuntimeError(
        new ReferenceError('y is not defined'),
      );
      assert.ok(msg.includes('variabel'), 'should mention variabel');
      assert.ok(!msg.includes('ReferenceError'), 'should NOT contain ReferenceError');
    });

    test('RangeError → jangkauan message', () => {
      const msg = ErrorHandler.handleRuntimeError(
        new RangeError('Invalid array length'),
      );
      assert.ok(msg.includes('jangkauan'), 'should mention jangkauan');
      assert.ok(!msg.includes('RangeError'), 'should NOT contain RangeError');
    });
  });

  suite('handleTimeout()', () => {
    test('returns Indonesian timeout message', () => {
      const msg = ErrorHandler.handleTimeout();
      assert.ok(msg.includes('10 detik'), 'should mention 10 detik');
      assert.ok(msg.includes('dihentikan'), 'should say dihentikan');
      assert.ok(!msg.includes('timeout'), 'should NOT contain English timeout');
    });
  });

  suite('handleNodeVersion()', () => {
    test('includes version numbers in Indonesian message', () => {
      const msg = ErrorHandler.handleNodeVersion('v14.17.0', 18);
      assert.ok(msg.includes('Node.js'), 'should mention Node.js');
      assert.ok(msg.includes('18'), 'should mention required version 18');
      assert.ok(msg.includes('v14.17.0'), 'should include current version');
      assert.ok(msg.includes('Versi Anda'), 'should say Versi Anda');
    });

    test('works with different required versions', () => {
      const msg = ErrorHandler.handleNodeVersion('v16.0.0', 20);
      assert.ok(msg.includes('20'), 'should mention required version 20');
      assert.ok(msg.includes('v16.0.0'), 'should include current version');
    });
  });

  suite('handleCorruptedProgress()', () => {
    test('returns Indonesian corrupted message', () => {
      const msg = ErrorHandler.handleCorruptedProgress();
      assert.ok(msg.includes('File progress'), 'should mention File progress');
      assert.ok(msg.includes('rusak'), 'should say rusak');
      assert.ok(msg.includes('diatur ulang'), 'should say diatur ulang');
    });
  });

  suite('handleExerciseNotFound()', () => {
    test('includes exercise ID in Indonesian message', () => {
      const msg = ErrorHandler.handleExerciseNotFound('basics-01');
      assert.ok(msg.includes('Latihan tidak ditemukan'), 'should say Latihan tidak ditemukan');
      assert.ok(msg.includes('basics-01'), 'should include exercise ID');
    });
  });

  suite('handleWebviewFailure()', () => {
    test('returns Indonesian webview failure message', () => {
      const msg = ErrorHandler.handleWebviewFailure();
      assert.ok(msg.includes('Gagal memuat'), 'should say Gagal memuat');
      assert.ok(msg.includes('panel latihan'), 'should mention panel latihan');
      assert.ok(msg.includes('coba lagi'), 'should say coba lagi');
    });
  });

  // ----------------------------------------------------------
  // isRecoverable
  // ----------------------------------------------------------

  suite('isRecoverable()', () => {
    test('SyntaxError is NOT recoverable', () => {
      assert.strictEqual(
        ErrorHandler.isRecoverable(new SyntaxError('x')),
        false,
      );
    });

    test('TypeError is NOT recoverable', () => {
      assert.strictEqual(
        ErrorHandler.isRecoverable(new TypeError('x')),
        false,
      );
    });

    test('ReferenceError is NOT recoverable', () => {
      assert.strictEqual(
        ErrorHandler.isRecoverable(new ReferenceError('x')),
        false,
      );
    });

    test('RangeError is NOT recoverable', () => {
      assert.strictEqual(
        ErrorHandler.isRecoverable(new RangeError('x')),
        false,
      );
    });

    test('TIMEOUT sentinel IS recoverable', () => {
      assert.strictEqual(ErrorHandler.isRecoverable('TIMEOUT'), true);
    });

    test('VERSION_MISMATCH sentinel IS recoverable', () => {
      assert.strictEqual(ErrorHandler.isRecoverable('VERSION_MISMATCH'), true);
    });

    test('generic Error is NOT recoverable', () => {
      assert.strictEqual(
        ErrorHandler.isRecoverable(new Error('x')),
        false,
      );
    });
  });

  // ----------------------------------------------------------
  // Cross-cutting: zero English in ALL messages
  // ----------------------------------------------------------

  suite('Indonesian-only guarantee', () => {
    const englishTerms = [
      'SyntaxError',
      'TypeError',
      'ReferenceError',
      'RangeError',
      'error',
      'timeout',
      'stack trace',
      'cannot read',
      'is not defined',
    ];

    test('handleSyntaxError() — no English', () => {
      const msg = ErrorHandler.handleSyntaxError();
      for (const term of englishTerms) {
        assert.ok(!msg.includes(term), `should NOT contain "${term}"`);
      }
    });

    test('handleTimeout() — no English', () => {
      const msg = ErrorHandler.handleTimeout();
      for (const term of englishTerms) {
        assert.ok(
          !msg.includes(term),
          `handleTimeout should NOT contain "${term}"`,
        );
      }
    });

    test('handleNodeVersion() — no raw error terms', () => {
      const msg = ErrorHandler.handleNodeVersion('v14.0.0', 18);
      assert.ok(!msg.includes('error'), 'should NOT contain "error"');
      assert.ok(!msg.includes('version mismatch'), 'should NOT contain "version mismatch"');
    });
  });
});
