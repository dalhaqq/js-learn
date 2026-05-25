/**
 * @file Centralized error handling for ALL user-facing errors.
 *
 * Every error message is in Indonesian — zero English, zero raw stack traces.
 * The extension integrates this in Task 11 to replace inline error strings.
 *
 * Design decisions:
 * - All methods are static — no instantiation needed.
 * - `handleError()` auto-detects error type via `instanceof`.
 * - `isRecoverable()` distinguishes errors the system can heal from
 *   (timeout, version mismatch, corrupted file) vs errors the learner
 *   must fix (syntax, type, reference, range).
 * - Context parameter carries extra info (exercise ID, version, etc.).
 */

// ──────────────────────────────────────────────
// Error type constants
// ──────────────────────────────────────────────

const ERR_TIMEOUT = 'TIMEOUT' as const;
const ERR_VERSION = 'VERSION_MISMATCH' as const;

// ──────────────────────────────────────────────
// ErrorHandler
// ──────────────────────────────────────────────

export class ErrorHandler {
  // ----------------------------------------------------------
  // Auto-detect dispatcher
  // ----------------------------------------------------------

  /**
   * Route any error to the correct Indonesian message.
   *
   * @param error  The thrown value (Error instance, string, or unknown).
   * @param context  Optional metadata — exercise ID, version string, etc.
   * @returns An Indonesian error message suitable for user display.
   */
  static handleError(error: unknown, context?: string): string {
    // Timeout sentinel (string marker used internally)
    if (error === ERR_TIMEOUT) {
      return ErrorHandler.handleTimeout();
    }

    // Version mismatch sentinel
    if (error === ERR_VERSION) {
      return ErrorHandler.handleNodeVersion(context ?? '0.0.0', 18);
    }

    if (error instanceof SyntaxError) {
      return ErrorHandler.handleSyntaxError();
    }

    if (error instanceof TypeError) {
      return ErrorHandler.handleRuntimeError(error);
    }

    if (error instanceof ReferenceError) {
      return ErrorHandler.handleRuntimeError(error);
    }

    if (error instanceof RangeError) {
      return ErrorHandler.handleRuntimeError(error);
    }

    if (error instanceof Error) {
      // Unknown Error — fallback to message if it's already safe Indonesian,
      // otherwise return generic Indonesian fallback.
      const msg = error.message;
      if (msg && !/^(SyntaxError|TypeError|ReferenceError|RangeError|Error)/.test(msg)) {
        return msg;
      }
      return 'Terjadi kesalahan saat menjalankan kode.';
    }

    // String or primitive
    if (typeof error === 'string') {
      return error || 'Terjadi kesalahan saat menjalankan kode.';
    }

    return 'Terjadi kesalahan saat menjalankan kode.';
  }

  // ----------------------------------------------------------
  // Specific error-type handlers
  // ----------------------------------------------------------

  /**
   * Syntax error — brackets, quotes, semicolons.
   */
  static handleSyntaxError(): string {
    return 'Ada kesalahan penulisan kode. Periksa kembali tanda kurung, kutipan, atau titik koma.';
  }

  /**
   * Runtime error — auto-detects TypeError, ReferenceError, RangeError.
   */
  static handleRuntimeError(error: Error): string {
    if (error instanceof TypeError) {
      return 'Terjadi kesalahan tipe data. Periksa kembali jenis data yang digunakan.';
    }

    if (error instanceof ReferenceError) {
      return 'Ada variabel yang belum didefinisikan. Periksa kembali nama variabel Anda.';
    }

    if (error instanceof RangeError) {
      return 'Terjadi kesalahan jangkauan nilai. Periksa kembali angka atau indeks yang digunakan.';
    }

    // Generic fallback for any other Error subtype
    return 'Terjadi kesalahan saat menjalankan kode.';
  }

  /**
   * Execution timeout (>10 s).
   */
  static handleTimeout(): string {
    return 'Kode berjalan terlalu lama (>10 detik) dan dihentikan.';
  }

  /**
   * Node.js version too old.
   *
   * @param currentVersion  The running Node version (e.g. "v16.20.0").
   * @param requiredVersion  The minimum major version required (e.g. 18).
   */
  static handleNodeVersion(
    currentVersion: string,
    requiredVersion: number,
  ): string {
    return (
      'Latihan ini membutuhkan Node.js versi ' +
      requiredVersion +
      '+. Versi Anda: ' +
      currentVersion +
      '.'
    );
  }

  /**
   * Corrupted progress file — data will be reset.
   */
  static handleCorruptedProgress(): string {
    return 'File progress rusak. Data progress diatur ulang.';
  }

  /**
   * Exercise not found by ID.
   *
   * @param id  The exercise ID that was looked up.
   */
  static handleExerciseNotFound(id: string): string {
    return 'Latihan tidak ditemukan: ' + id;
  }

  /**
   * Webview failed to load.
   */
  static handleWebviewFailure(): string {
    return 'Gagal memuat panel latihan. Silakan coba lagi.';
  }

  // ----------------------------------------------------------
  // Recovery classification
  // ----------------------------------------------------------

  /**
   * Determine whether the error is recoverable by the system.
   *
   * Recoverable errors: timeout, version mismatch, corrupted progress,
   * exercise-not-found, webview failure.
   *
   * Non-recoverable errors: syntax, type, reference, range — these
   * require the learner to fix their code.
   */
  static isRecoverable(error: unknown): boolean {
    if (error === ERR_TIMEOUT) {
      return true;
    }

    if (error === ERR_VERSION) {
      return true;
    }

    if (error instanceof SyntaxError) {
      return false;
    }

    if (error instanceof TypeError) {
      return false;
    }

    if (error instanceof ReferenceError) {
      return false;
    }

    if (error instanceof RangeError) {
      return false;
    }

    // Unknown errors — treat as non-recoverable to be safe.
    return false;
  }
}
