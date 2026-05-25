/**
 * @file Indonesian message catalog (I18N) for JS Learn.
 *
 * Every user-facing string visible to the learner is centralized here.
 * Categories: errors, ui, verification, progress, setup.
 *
 * Design:
 * - Function-valued fields accept dynamic arguments (e.g. version numbers, IDs).
 * - String-valued fields are static Indonesian phrases.
 * - `DIFFICULTY_LABELS` maps difficulty keys to labels for webview rendering.
 *
 * Terminology matches existing codebase usage — DO NOT use Google Translate
 * for values; only use phrases already established in the project.
 */

// ──────────────────────────────────────────────
// Difficulty label map (shared by both webview panel types)
// ──────────────────────────────────────────────

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Mudah',
  medium: 'Sedang',
  hard: 'Sulit',
};

// ──────────────────────────────────────────────
// Central message catalog
// ──────────────────────────────────────────────

export const I18N = {
  errors: {
    /** Syntax error — malformed code (missing brackets, quotes, semicolons). */
    syntax:
      'Ada kesalahan penulisan kode. Periksa kembali tanda kurung, kutipan, atau titik koma.',

    /** TypeError — incompatible data type for an operation. */
    typeError: 'Tipe data tidak sesuai. Periksa kembali operasi yang dilakukan.',

    /** ReferenceError — variable or function not found. */
    referenceError:
      'Variabel atau fungsi tidak ditemukan. Periksa kembali nama variabel yang digunakan.',

    /** RangeError — value outside the allowed range. */
    rangeError: 'Nilai di luar jangkauan yang diizinkan.',

    /** Timeout — execution took too long (likely infinite loop). */
    timeout:
      'Waktu eksekusi kode terlalu lama (timeout). Apakah ada perulangan tak terbatas?',

    /** Node.js version requirement warning. */
    nodeVersion: (current: string, required: string): string =>
      `Node.js versi ${required} atau lebih baru diperlukan. Versi Anda: ${current}. Beberapa latihan mungkin tidak berfungsi.`,

    /** Corrupted progress data. */
    corruptedProgress: 'File progress rusak, memulai ulang.',

    /** Exercise ID was not found in the provider. */
    exerciseNotFound: (id: string): string => `Latihan tidak ditemukan: ${id}`,

    /** Generic webview execution failure. */
    webviewFailure: 'Terjadi kesalahan saat menjalankan kode.',
  },

  ui: {
    /** Primary run button label (standard exercises). */
    runButton: '▶ Jalankan Kode',

    /** Primary run button label (DOM exercises). */
    runDomButton: '▶ Jalankan DOM',

    /** Skip button label. */
    skipButton: '⏭ Lewati',

    /** Section heading for collapsible hints. */
    hintLabel: '💡 Petunjuk',

    /** Individual hint summary text. */
    hintItem: (n: number): string => `Petunjuk ${n}`,

    /** Difficulty badge labels (lookup via DIFFICULTY_LABELS). */
    difficultyEasy: 'Mudah',
    difficultyMedium: 'Sedang',
    difficultyHard: 'Sulit',

    /** Completed exercise badge. */
    completed: '✓ Selesai',

    /** Skipped exercise badge. */
    skipped: 'Lewat',

    /** Sandbox area heading (DOM panel). */
    sandboxLabel: 'Area DOM',

    /** Sandbox result heading (DOM panel). */
    domResultLabel: 'Hasil DOM',

    /** Placeholder for code editor (no dedicated label yet). */
    codeEditor: 'Editor Kode',

    /** Shown when an exercise has zero hints. */
    noHints: 'Tidak ada petunjuk tersedia.',
  },

  verification: {
    /** Output match success. */
    pass: 'Berhasil! Output sesuai.',

    /** Output mismatch. */
    fail: 'Hasil tidak sesuai.',

    /** Expected output label (verification detail). */
    expectedLabel: 'Diharapkan:',

    /** Actual output label (verification detail). */
    actualLabel: 'Didapatkan:',

    /** All verifications passed (output + test mode). */
    passAll: 'Berhasil! Semua verifikasi lulus.',

    /** Test assertion failed. */
    failTest: 'Tes gagal.',

    /** All tests passed. */
    testPass: 'Berhasil! Semua tes lulus.',

    /** Single test failure message with dynamic arguments. */
    testFail: (testNum: number, message: string): string =>
      `Tes ${testNum} gagal: ${message}`,

    /** Exercise has no test to run. */
    noTestRequired: 'Latihan ini tidak memerlukan tes.',

    /** Runtime error during code execution. */
    runtimeError: 'Kode mengalami kesalahan saat dijalankan.',

    /** Code execution timed out (used by TestVerifier). */
    timeout: 'Kode berjalan terlalu lama dan dihentikan.',

    /** DOM output match success. */
    passDom: 'Berhasil! DOM sesuai.',

    /** DOM output mismatch. */
    failDom: 'DOM tidak sesuai.',
  },

  progress: {
    /** Warning when progress file is corrupted. */
    corrupted: 'File progress rusak, memulai ulang.',

    /** Warning before resetting all progress. */
    resetWarning: 'Semua progress akan dihapus. Lanjutkan?',
  },

  setup: {
    /** Node.js version too old warning. */
    nodeVersionWarning: (current: string, required: string): string =>
      `Node.js versi ${required} atau lebih baru diperlukan. Versi Anda: ${current}. Beberapa latihan mungkin tidak berfungsi.`,

    /** Node.js not found on the system. */
    nodejsNotFound: 'Node.js tidak ditemukan.',

    /** Exercise not found (generic, no ID). */
    exerciseNotFound: 'Latihan tidak ditemukan.',
  },
} as const;
