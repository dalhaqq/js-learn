/**
 * @file FileExerciseProvider — loads exercises from bundled JSON files.
 *
 * Implements the ExerciseProvider interface to serve static exercises.
 * In Phase 2, a second provider (e.g. AIExerciseProvider) can be swapped in
 * via the same interface.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Exercise, LessonGroup, ExerciseProvider } from '../types';
import { GROUPS } from '../exercises/groups';

export class FileExerciseProvider implements ExerciseProvider {
  private exercises: Map<string, Exercise> = new Map();

  constructor(exercisesDir: string) {
    const files = fs.readdirSync(exercisesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const exercise: Exercise = JSON.parse(
        fs.readFileSync(path.join(exercisesDir, file), 'utf8')
      );
      this.exercises.set(exercise.id, exercise);
    }
  }

  async getExercises(): Promise<Exercise[]> {
    return Array.from(this.exercises.values());
  }

  async getExercise(id: string): Promise<Exercise | undefined> {
    return this.exercises.get(id);
  }

  async getLessonGroups(): Promise<LessonGroup[]> {
    return GROUPS;
  }
}
