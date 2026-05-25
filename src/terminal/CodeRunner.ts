/**
 * @file Sandboxed JavaScript code executor with timeout protection.
 *
 * Runs learner code in a child `node` process via `execFile` to
 * isolate it from the VS Code extension host.  All errors are
 * translated into Indonesian so beginners never see raw stack traces.
 *
 * Design decisions:
 * - `execFile`, not `exec` — no shell injection risk.
 * - Temp files go in `os.tmpdir()/jslearn/` (not workspace).
 * - `windowsHide: true` — no console windows on Windows.
 * - Default timeout: 10 000 ms.
 * - Cleanup is in a `finally` block so temp files are never leaked.
 */

import { execFile } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { I18N } from '../i18n/messages';

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

export interface RunResult {
  /** Combined stdout + stderr, trimmed. */
  output: string;
  /** Process exit code.  -1 when killed by timeout. */
  exitCode: number;
  /** Whether the run was aborted by the timeout. */
  timedOut: boolean;
  /**
   * Human-readable error message in Indonesian.
   * Only set when execution fails (non-zero exit or timeout).
   */
  error?: string;
}

export interface RunOptions {
  /** Maximum execution time in milliseconds.  Default: 10 000 (10 s). */
  timeout?: number;
}

// ──────────────────────────────────────────────
// CodeRunner
// ──────────────────────────────────────────────

export class CodeRunner {
  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Execute learner JavaScript code in a sandboxed child process.
   *
   * @param code  The JavaScript source code to execute.
   * @param options  Optional configuration (timeout override).
   * @returns A `RunResult` with output, exit code, and any translated error.
   */
  async run(code: string, options?: RunOptions): Promise<RunResult> {
    const timeout = options?.timeout ?? 10_000;
    const tempDir = path.join(os.tmpdir(), 'jslearn');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, `exercise-${Date.now()}.js`);
    fs.writeFileSync(tempFile, code, 'utf8');

    try {
      return await new Promise<RunResult>((resolve) => {
        execFile(
          'node',
          [tempFile],
          {
            timeout,
            maxBuffer: 1024 * 1024, // 1 MB
            windowsHide: true,
          },
          (error, stdout, stderr) => {
            if (error) {
              const err = error as { killed?: boolean; code?: number | string };

              // Timeout detection — the process was killed by execFile's timer.
              if (err.killed) {
                resolve({
                  output: '',
                  exitCode: -1,
                  timedOut: true,
                  error: this.translateError('timeout'),
                });
                return;
              }

              // Runtime / syntax error — merge stdout + stderr for context.
              const message = stdout + stderr;
              resolve({
                output: message.trim(),
                exitCode: Number(err.code) || 1,
                timedOut: false,
                error: this.translateError(message),
              });
              return;
            }

            // Happy path — no error object.
            resolve({
              output: stdout.trim(),
              exitCode: 0,
              timedOut: false,
            });
          },
        );
      });
    } finally {
      // Always clean up the temp file.
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Best-effort — file may have already been removed by the OS.
      }
    }
  }

  // ----------------------------------------------------------
  // Error translation
  // ----------------------------------------------------------

  /**
   * Translate raw error text into a beginner-friendly Indonesian message.
   *
   * Exposed as a public method so tests can verify translations directly
   * without spawning child processes for every error class.
   */
  translateError(raw: string): string {
    if (raw === 'timeout') {
      return I18N.errors.timeout;
    }

    if (raw.includes('SyntaxError')) {
      return I18N.errors.syntax;
    }

    if (raw.includes('ReferenceError')) {
      return I18N.errors.referenceError;
    }

    if (raw.includes('TypeError')) {
      return I18N.errors.typeError;
    }

    if (raw.includes('RangeError')) {
      return I18N.errors.rangeError;
    }

    // Fallback — return the raw message trimmed (no stack trace translation
    // available for this class).
    const trimmed = raw.trim();
    return trimmed || I18N.errors.webviewFailure;
  }
}
