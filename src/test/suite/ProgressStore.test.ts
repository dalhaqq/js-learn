import * as assert from 'assert';
import { ProgressFile, ExerciseProgress } from '../../types';
import { ProgressStore } from '../../storage/ProgressStore';

// ──────────────────────────────────────────────
// Mock Memento — in-memory replacement for vscode.Memento
// ──────────────────────────────────────────────

class MockMemento {
  private store = new Map<string, unknown>();
  /** When true, get() throws to simulate corrupted storage */
  private throwOnGet = false;

  setThrowOnGet(shouldThrow: boolean): void {
    this.throwOnGet = shouldThrow;
  }

  get<T>(key: string): T | undefined {
    if (this.throwOnGet) {
      throw new Error('Simulated corrupted data');
    }
    return this.store.get(key) as T | undefined;
  }

  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
    return Promise.resolve();
  }

  /** Direct access for test setup — bypasses throwOnGet */
  _setRaw(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

// ──────────────────────────────────────────────
// Mock ExtensionContext
// ──────────────────────────────────────────────

class MockContext {
  globalState: MockMemento;
  storageUri = undefined;

  constructor() {
    this.globalState = new MockMemento();
  }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

suite('ProgressStore Test Suite', () => {
  let context: MockContext;
  let store: ProgressStore;

  setup(() => {
    context = new MockContext();
    store = new ProgressStore(context as any);
  });

  test('load() returns default ProgressFile when nothing is stored', () => {
    const result = store.load();

    assert.strictEqual(result.schemaVersion, 1);
    assert.deepStrictEqual(result.exercises, {});
    assert.ok(
      typeof result.lastUpdated === 'string' && result.lastUpdated.length > 0,
      'lastUpdated should be a non-empty ISO string'
    );
  });

  test('markCompleted() persists exercise as completed and increments attempts', () => {
    const exerciseId = 'uuid-exercise-1';

    store.markCompleted(exerciseId);

    const progress = store.getProgress(exerciseId);
    assert.ok(progress, 'Progress should exist after markCompleted');
    assert.strictEqual(progress!.completed, true);
    assert.strictEqual(progress!.skipped, false);
    assert.strictEqual(progress!.attempts, 1);
    assert.ok(
      typeof progress!.completedAt === 'string',
      'completedAt should be set'
    );
  });

  test('markCompleted() increments attempts on repeated completion', () => {
    const exerciseId = 'uuid-exercise-repeat';

    store.markCompleted(exerciseId);
    store.markCompleted(exerciseId);
    store.markCompleted(exerciseId);

    const progress = store.getProgress(exerciseId);
    assert.strictEqual(progress!.attempts, 3);
    assert.strictEqual(progress!.completed, true);
  });

  test('markSkipped() persists exercise as skipped without incrementing attempts', () => {
    const exerciseId = 'uuid-exercise-skip';

    store.markSkipped(exerciseId);

    const progress = store.getProgress(exerciseId);
    assert.ok(progress, 'Progress should exist after markSkipped');
    assert.strictEqual(progress!.completed, false);
    assert.strictEqual(progress!.skipped, true);
    assert.strictEqual(progress!.attempts, 0);
    assert.ok(
      typeof progress!.completedAt === 'string',
      'completedAt should be set'
    );
  });

  test('isCompleted() returns true for completed exercises, false otherwise', () => {
    const completedId = 'uuid-completed';
    const skippedId = 'uuid-skipped';
    const unknownId = 'uuid-unknown';

    store.markCompleted(completedId);
    store.markSkipped(skippedId);

    assert.strictEqual(store.isCompleted(completedId), true);
    assert.strictEqual(store.isCompleted(skippedId), false);
    assert.strictEqual(store.isCompleted(unknownId), false);
  });

  test('getProgress() returns undefined for unknown exercise', () => {
    const result = store.getProgress('uuid-nonexistent');
    assert.strictEqual(result, undefined);
  });

  test('getAllProgress() returns a snapshot of all exercises', () => {
    store.markCompleted('uuid-a');
    store.markCompleted('uuid-b');
    store.markSkipped('uuid-c');

    const all = store.getAllProgress();
    const keys = Object.keys(all);

    assert.strictEqual(keys.length, 3);
    assert.ok(keys.includes('uuid-a'));
    assert.ok(keys.includes('uuid-b'));
    assert.ok(keys.includes('uuid-c'));
    assert.strictEqual(all['uuid-a'].completed, true);
    assert.strictEqual(all['uuid-c'].skipped, true);
  });

  test('getAllProgress() returns a shallow copy — mutations do not affect store', () => {
    store.markCompleted('uuid-original');

    const all = store.getAllProgress();
    // Mutate the copy
    all['uuid-original'] = { completed: false, skipped: true, attempts: 99 };

    // Reload from store should still have the original values
    const reloaded = store.getProgress('uuid-original');
    assert.strictEqual(reloaded!.completed, true);
    assert.strictEqual(reloaded!.attempts, 1);
  });

  test('markCompleted persists across multiple loads (persistence test)', () => {
    store.markCompleted('uuid-persist');

    // Simulate a fresh store instance reading from same mock state
    const store2 = new ProgressStore(context as any);
    const progress = store2.getProgress('uuid-persist');

    assert.ok(progress);
    assert.strictEqual(progress!.completed, true);
  });

  test('reset() clears all stored progress', () => {
    store.markCompleted('uuid-to-clear');

    store.reset();

    const result = store.load();
    assert.deepStrictEqual(result.exercises, {});
    assert.strictEqual(result.schemaVersion, 1);
  });

  test('load() recovers from corrupted data with fresh state', () => {
    // Simulate corruption by making get() throw
    context.globalState.setThrowOnGet(true);

    const result = store.load();

    // Should return a fresh default, not throw
    assert.strictEqual(result.schemaVersion, 1);
    assert.deepStrictEqual(result.exercises, {});
  });

  test('load() migrates schema version 0 to version 1', () => {
    // Store old-format data (schemaVersion 0)
    const oldData: ProgressFile = {
      schemaVersion: 0,
      exercises: { 'uuid-legacy': { completed: true, skipped: false, attempts: 1 } },
      lastUpdated: '2024-01-01T00:00:00.000Z',
    };
    context.globalState._setRaw('jslearn.progress', oldData);

    const result = store.load();

    // Migration resets to fresh state
    assert.strictEqual(result.schemaVersion, 1);
    assert.deepStrictEqual(result.exercises, {});
  });

  test('handles multiple exercises with mixed statuses', () => {
    store.markCompleted('uuid-fn-01');
    store.markCompleted('uuid-fn-02');
    store.markSkipped('uuid-skip-01');
    store.markCompleted('uuid-fn-03');
    store.markSkipped('uuid-skip-02');

    assert.strictEqual(store.isCompleted('uuid-fn-01'), true);
    assert.strictEqual(store.isCompleted('uuid-fn-02'), true);
    assert.strictEqual(store.isCompleted('uuid-skip-01'), false);
    assert.strictEqual(store.isCompleted('uuid-fn-03'), true);
    assert.strictEqual(store.isCompleted('uuid-skip-02'), false);

    const all = store.getAllProgress();
    assert.strictEqual(Object.keys(all).length, 5);

    // Verify attempts
    assert.strictEqual(all['uuid-fn-01'].attempts, 1);
    assert.strictEqual(all['uuid-fn-02'].attempts, 1);
    assert.strictEqual(all['uuid-fn-03'].attempts, 1);
    assert.strictEqual(all['uuid-skip-01'].attempts, 0);
    assert.strictEqual(all['uuid-skip-02'].attempts, 0);
  });
});
