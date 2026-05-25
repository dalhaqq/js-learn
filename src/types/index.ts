/**
 * @file Shared TypeScript types for the JS Learn extension.
 *
 * Design decisions:
 * - No `any` usage — every type is strictly defined.
 * - No hardcoded exercise data — types only, no data.
 * - No circular type dependencies.
 * - `ExerciseProvider` interface serves as the extensibility hook
 *   for Phase 2 AI-generated exercises.
 * - `ProgressFile.schemaVersion` supports future migration of
 *   persisted progress files.
 * - Educational content is in Indonesian; type field names remain
 *   in standard English.
 */

// ──────────────────────────────────────────────
// Supported exercise categories
// ──────────────────────────────────────────────

export type ExerciseType =
  | 'write'
  | 'debug'
  | 'fill-blank'
  | 'multiple-choice';

// ──────────────────────────────────────────────
// Difficulty levels
// ──────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';

// ──────────────────────────────────────────────
// Curriculum topics
// ──────────────────────────────────────────────

export type Topic = 'basics' | 'async' | 'dom' | 'apis' | 'dsa';

// ──────────────────────────────────────────────
// Verification modes for checking exercise output
// ──────────────────────────────────────────────

export type VerificationMode = 'output' | 'test' | 'both';

// ──────────────────────────────────────────────
// Tracks a learner's progress on a single exercise
// ──────────────────────────────────────────────

export interface ExerciseProgress {
  completed: boolean;
  skipped: boolean;
  completedAt?: string;
  attempts: number;
}

// ──────────────────────────────────────────────
// Full exercise definition
// ──────────────────────────────────────────────

export interface Exercise {
  id: string;
  type: ExerciseType;
  title: string;
  description: string;
  difficulty: Difficulty;
  topic: Topic;
  prerequisites: string[];
  starterCode: string;
  blanks?: string[];
  choices?: { label: string; value: string }[];
  solution: string;
  verification: {
    mode: VerificationMode;
    expectedOutput?: string;
    testCode?: string;
  };
  hints: string[];
  requiredNodeVersion?: number;
}

// ──────────────────────────────────────────────
// Persisted progress file shape
// ──────────────────────────────────────────────

export interface ProgressFile {
  schemaVersion: number;
  exercises: Record<string, ExerciseProgress>;
  lastUpdated: string;
}

// ──────────────────────────────────────────────
// Groups exercises into lesson units
// ──────────────────────────────────────────────

export interface LessonGroup {
  id: string;
  title: string;
  topic: Topic;
  exercises: string[];
}

// ──────────────────────────────────────────────
// Result returned by a Verifier
// ──────────────────────────────────────────────

export interface VerificationResult {
  passed: boolean;
  message: string;
  details?: string;
  /** Raw stdout from code execution (console.log output). Only set for output-mode exercises. */
  output?: string;
}

// ──────────────────────────────────────────────
// Extensibility hook — pluggable exercise source
// (e.g. static JSON, Phase 2 AI generator, remote API)
// ──────────────────────────────────────────────

export interface ExerciseProvider {
  getExercises(): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | undefined>;
  getLessonGroups(): Promise<LessonGroup[]>;
}

// ──────────────────────────────────────────────
// Pluggable verification strategy
// ──────────────────────────────────────────────

export interface Verifier {
  verify(exercise: Exercise, output: string): VerificationResult;
}
