/**
 * @file Index file — loads all exercises from JSON files and exports them as an array.
 *
 * Design decisions:
 * - Exercises are loaded from individual JSON files in src/exercises/.
 * - Adding a new exercise = adding a JSON file — no code changes needed.
 * - Uses fs.readFileSync because exercises are bundled with the extension.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Exercise } from '../types';

const EXERCISES_DIR = __dirname;

function loadExercises(): Exercise[] {
  const files = fs.readdirSync(EXERCISES_DIR).filter(f => f.endsWith('.json'));
  const exercises: Exercise[] = [];

  for (const file of files.sort()) {
    const raw = fs.readFileSync(path.join(EXERCISES_DIR, file), 'utf8');
    const exercise: Exercise = JSON.parse(raw);
    exercises.push(exercise);
  }

  return exercises;
}

export const ALL_EXERCISES: Exercise[] = loadExercises();
