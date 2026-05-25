/**
 * @file OutputVerifier — whitespace-tolerant output comparison.
 *
 * Normalizes both expected and actual output before comparison:
 * - Trims leading/trailing whitespace
 * - Normalizes line endings (CRLF → LF)
 * - Strips trailing whitespace from each line
 * - Collapses runs of 3+ blank lines into 2
 */

import { Exercise, Verifier, VerificationResult } from '../types';
import { I18N } from '../i18n/messages';

export class OutputVerifier implements Verifier {
  verify(exercise: Exercise, output: string): VerificationResult {
    const expected = exercise.verification.expectedOutput ?? '';

    const normalizedActual = this.normalize(output);
    const normalizedExpected = this.normalize(expected);

    if (normalizedActual === normalizedExpected) {
      return {
        passed: true,
        message: I18N.verification.pass,
      };
    }

    return {
      passed: false,
      message: I18N.verification.fail,
      details: `${I18N.verification.expectedLabel}\n${expected}\n\n${I18N.verification.actualLabel}\n${output}`,
    };
  }

  /**
   * Normalize a string for whitespace-tolerant comparison.
   *
   * Operations (order matters):
   * 1. CRLF → LF (Windows line endings)
   * 2. Strip trailing whitespace per line
   * 3. Collapse 3+ consecutive blank lines → 2
   * 4. Trim overall leading/trailing whitespace
   */
  private normalize(str: string): string {
    return str
      .replace(/\r\n/g, '\n')          // CRLF → LF
      .replace(/[ \t]+$/gm, '')        // trailing whitespace per line
      .replace(/\n{3,}/g, '\n\n')      // collapse 3+ blank lines → 2
      .trim();                          // leading/trailing whitespace
  }
}
