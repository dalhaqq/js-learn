/**
 * @file TestVerifier — assertion-based exercise verification with sandboxed execution.
 *
 * Bundles a minimal `assert(condition, message)` function into the learner's
 * code sandbox so tests can run without exposing Node.js globals.  All
 * communication between the sandbox and the verifier happens through stdout
 * sentinel strings — no shared mutable state.
 *
 * Dependencies:
 * - Exercise, Verifier, VerificationResult from ../types
 * - RunResult (defined here until CodeRunner from Task 8 is available)
 */

import { Exercise, VerificationResult } from '../types';
import { I18N } from '../i18n/messages';

// ──────────────────────────────────────────────
// CodeRunner dependency contract (Task 8)
// ──────────────────────────────────────────────

/**
 * Result returned by a CodeRunner after executing code in a sandbox.
 * Defined here so TestVerifier does not couple to the full CodeRunner module
 * before Task 8 has landed.
 */
export interface RunResult {
  output: string;
  exitCode: number;
  timedOut: boolean;
}

/** Minimal interface that any CodeRunner must satisfy for TestVerifier. */
export interface CodeRunnerLike {
  run(code: string, options?: { timeout?: number }): Promise<RunResult>;
}

// ──────────────────────────────────────────────
// Sandbox helpers
// ──────────────────────────────────────────────

/**
 * Builds the bundled `assert` function injected into the learner sandbox.
 *
 * Design constraints:
 * - No Node.js globals (`require`, `process`, `__dirname`, …) are touched.
 * - All tracking goes through `__assertions` / `__results` arrays in the
 *   sandbox scope — the verifier only reads stdout.
 * - On failure the error message encodes an opaque JSON payload so the
 *   verifier can reconstruct which assertion failed.
 */
function buildAssertScript(): string {
  return `
const __assertions = [];
const __results = [];
function assert(condition, message) {
  __assertions.push({ condition, message });
  if (!condition) {
    throw new Error('__ASSERT_FAIL__:' + JSON.stringify({ index: __assertions.length, message }));
  }
}
`;
}

/**
 * Wraps learner code together with the bundled assert and the exercise's
 * testCode so the whole thing runs in a single sandbox invocation.
 *
 * stdout sentinel protocol:
 * - `__ALL_ASSERTIONS_PASSED__`   → every assert(…) returned truthy
 * - `__ASSERT_FAILED__:Tes N gagal: message` → an assertion threw
 * - `__RUNTIME_ERROR__:message`   → any other uncaught error
 */
function wrapTestCode(learnerCode: string, testCode: string): string {
  // Pre-compute the test-fail message format from I18N for sandbox embedding.
  // The sandbox runs in a child Node process and cannot import the I18N module.
  // Use I18N.verification.testFail(999, '') = "Tes 999 gagal: " as template,
  // then replace '999' with the actual test index in the sandbox.
  const testFailTemplate = I18N.verification.testFail(999, '');
  const testFailPrefix = '__ASSERT_FAILED__:';
  return `
${buildAssertScript()}
try {
  ${learnerCode}
  ${testCode}
  console.log('__ALL_ASSERTIONS_PASSED__');
} catch (e) {
  if (e.message && e.message.startsWith('__ASSERT_FAIL__:')) {
    const detail = JSON.parse(e.message.replace('__ASSERT_FAIL__:', ''));
    console.log('${testFailPrefix}' + '${testFailTemplate}'.replace('999', String(detail.index)) + detail.message);
  } else {
    console.log('__RUNTIME_ERROR__:' + e.message);
  }
}
`;
}

// ──────────────────────────────────────────────
// TestVerifier
// ──────────────────────────────────────────────

export class TestVerifier {
  private codeRunner: CodeRunnerLike;

  /**
   * @param codeRunner  Any object with a `run(code, options?)` method that
   *                    returns `Promise<RunResult>`.  The actual CodeRunner
   *                    implementation from Task 8 is injected at runtime.
   */
  constructor(codeRunner: CodeRunnerLike) {
    this.codeRunner = codeRunner;
  }

  /**
   * Verify learner code by running the exercise's `verification.testCode`
   * assertions against it inside a sandboxed JavaScript environment.
   *
   * @param exercise  Exercise definition (must carry `.verification.testCode`
   *                  for assertion-based checks).
   * @param userCode  The learner's JavaScript source code as a string.
   * @returns         Pass/fail result with Indonesian messages and optional
   *                  assertion details.
   */
  async verify(
    exercise: Exercise,
    userCode: string
  ): Promise<VerificationResult> {
    // ── No testCode ──────────────────────────────
    const testCode = exercise.verification.testCode;
    if (!testCode) {
      return {
        passed: true,
        message: I18N.verification.noTestRequired,
      };
    }

    // ── Wrap and execute ─────────────────────────
    const wrapped = wrapTestCode(userCode, testCode);
    const result = await this.codeRunner.run(wrapped, { timeout: 10000 });

    // ── Timeout ──────────────────────────────────
    if (result.timedOut) {
      return {
        passed: false,
        message: I18N.verification.timeout,
      };
    }

    const output = result.output;

    // ── All passed ───────────────────────────────
    if (output.includes('__ALL_ASSERTIONS_PASSED__')) {
      return { passed: true, message: I18N.verification.testPass };
    }

    // ── Assertion failure ────────────────────────
    if (output.includes('__ASSERT_FAILED__:')) {
      const detailLine =
        output.split('\n').find((l) => l.includes('__ASSERT_FAILED__:')) || '';
      const detail = detailLine.replace('__ASSERT_FAILED__:', '').trim();
      return { passed: false, message: I18N.verification.failTest, details: detail };
    }

    // ── Runtime error or other ───────────────────
    return {
      passed: false,
      message: I18N.verification.runtimeError,
    };
  }
}
