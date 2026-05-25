/**
 * @file LessonTreeProvider test suite.
 *
 * Tests the TreeView provider's lock/unlock logic, icon resolution,
 * and tree structure. All data dependencies are mocked.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  LessonTreeItem,
  LessonTreeProvider,
  ProgressStore,
} from '../../providers/LessonTreeProvider';
import { Exercise, ExerciseProvider, LessonGroup } from '../../types';

// ── Mocks ──────────────────────────────────────────

/**
 * Build an ExerciseProvider mock with two groups:
 *   - basics  (3 exercises: ex-1, ex-2, ex-3)
 *   - async   (2 exercises: ex-4, ex-5)
 *
 * Prerequisite chains:
 *   ex-1 → no prereqs
 *   ex-2 → [ex-1]
 *   ex-3 → [ex-2]
 *   ex-4 → no prereqs
 *   ex-5 → [ex-4]
 */
function makeMockProvider(): ExerciseProvider {
  const groups: LessonGroup[] = [
    {
      id: 'basics',
      title: 'Dasar JavaScript',
      topic: 'basics',
      exercises: ['ex-1', 'ex-2', 'ex-3'],
    },
    {
      id: 'async',
      title: 'Async & Promise',
      topic: 'async',
      exercises: ['ex-4', 'ex-5'],
    },
  ];

  const baseExercise = (id: string, title: string, topic: 'basics' | 'async', prerequisites: string[]): Exercise => ({
    id,
    type: 'write' as const,
    title,
    description: '',
    difficulty: 'easy' as const,
    topic,
    prerequisites,
    starterCode: '',
    solution: '',
    verification: { mode: 'output' as const },
    hints: [],
  });

  const exercises: Record<string, Exercise> = {
    'ex-1': baseExercise('ex-1', 'Variables', 'basics', []),
    'ex-2': baseExercise('ex-2', 'Conditions', 'basics', ['ex-1']),
    'ex-3': baseExercise('ex-3', 'Loops', 'basics', ['ex-2']),
    'ex-4': baseExercise('ex-4', 'Callbacks', 'async', []),
    'ex-5': baseExercise('ex-5', 'Promises', 'async', ['ex-4']),
  };

  return {
    async getExercises(): Promise<Exercise[]> {
      return Object.values(exercises);
    },
    async getExercise(id: string): Promise<Exercise | undefined> {
      return exercises[id];
    },
    async getLessonGroups(): Promise<LessonGroup[]> {
      return groups;
    },
  };
}

/**
 * Build an in-memory ProgressStore mock with test helper methods.
 * Starts empty — no exercises completed or skipped.
 */
function makeMockStore() {
  const map = new Map<string, { completed: boolean; skipped: boolean }>();
  return {
    isCompleted(id: string): boolean {
      return map.get(id)?.completed ?? false;
    },
    getProgress(
      id: string,
    ): { completed: boolean; skipped: boolean } | undefined {
      return map.get(id);
    },
    /** Mark an exercise as completed (test helper). */
    setCompleted(id: string): void {
      map.set(id, { completed: true, skipped: false });
    },
    /** Mark an exercise as skipped (test helper). */
    setSkipped(id: string): void {
      map.set(id, { completed: false, skipped: true });
    },
  };
}

type MockStore = ReturnType<typeof makeMockStore>;

// ── Helpers ────────────────────────────────────────

function getIconId(item: LessonTreeItem): string | undefined {
  if (item.iconPath instanceof vscode.ThemeIcon) {
    return item.iconPath.id;
  }
  return undefined;
}

function hasCommand(item: LessonTreeItem): boolean {
  return item.command !== undefined;
}

// ── Suite ──────────────────────────────────────────

suite('LessonTreeProvider', () => {
  let provider: LessonTreeProvider;
  let store: MockStore;

  setup(() => {
    store = makeMockStore();
    provider = new LessonTreeProvider(makeMockProvider(), store as ProgressStore);
  });

  // ── getChildren root ───────────────────────────

  test('getChildren() returns one collapsible item per LessonGroup', async () => {
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 2, 'expected 2 groups');
    assert.strictEqual(items[0].label, 'Dasar JavaScript');
    assert.strictEqual(items[1].label, 'Async & Promise');
    assert.strictEqual(
      items[0].collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    assert.strictEqual(
      items[1].collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
  });

  // ── getChildren group ─────────────────────────

  test('getChildren(group) returns exercise items for that group', async () => {
    const groups = await provider.getChildren();
    const basicsGroup = groups[0];
    const items = await provider.getChildren(basicsGroup);

    assert.strictEqual(items.length, 3, 'expected 3 exercises in basics');
    assert.strictEqual(items[0].label, 'Variables');
    assert.strictEqual(items[1].label, 'Conditions');
    assert.strictEqual(items[2].label, 'Loops');
    assert.strictEqual(
      items[0].collapsibleState,
      vscode.TreeItemCollapsibleState.None,
    );
    assert.strictEqual(items[0].contextValue, 'lesson');
  });

  // ── First exercise unlocked ───────────────────

  test('first exercise in each group is always unlocked', async () => {
    const groups = await provider.getChildren();

    // Group 1 (basics) — first exercise
    const basicsItems = await provider.getChildren(groups[0]);
    assert.ok(hasCommand(basicsItems[0]), 'ex-1 should have a command');
    assert.strictEqual(
      basicsItems[0].command?.command,
      'jslearn.openExercise',
    );
    assert.strictEqual(
      basicsItems[0].command?.arguments?.[0],
      'ex-1',
    );
    assert.notStrictEqual(
      getIconId(basicsItems[0]),
      'lock',
      'ex-1 should NOT be locked',
    );

    // Group 2 (async) — first exercise
    const asyncItems = await provider.getChildren(groups[1]);
    assert.ok(hasCommand(asyncItems[0]), 'ex-4 should have a command');
    assert.notStrictEqual(
      getIconId(asyncItems[0]),
      'lock',
      'ex-4 should NOT be locked',
    );
  });

  // ── Locked when prerequisites not met ─────────

  test('subsequent exercises are locked when prerequisites are incomplete', async () => {
    const groups = await provider.getChildren();
    const basicsItems = await provider.getChildren(groups[0]);

    // ex-2 requires ex-1 → locked
    assert.strictEqual(getIconId(basicsItems[1]), 'lock');
    assert.ok(!hasCommand(basicsItems[1]), 'locked exercise should have no command');

    // ex-3 requires ex-2 → locked (ex-2 not completed either)
    assert.strictEqual(getIconId(basicsItems[2]), 'lock');
    assert.ok(!hasCommand(basicsItems[2]), 'locked exercise should have no command');
  });

  // ── Complete unlocks next ─────────────────────

  test('completing an exercise unlocks the next one', async () => {
    store.setCompleted('ex-1');

    const groups = await provider.getChildren();
    const basicsItems = await provider.getChildren(groups[0]);

    // ex-2 should now be unlocked
    assert.notStrictEqual(
      getIconId(basicsItems[1]),
      'lock',
      'ex-2 should be unlocked when ex-1 is completed',
    );
    assert.ok(hasCommand(basicsItems[1]));

    // ex-3 still locked (requires ex-2 which is not done)
    assert.strictEqual(getIconId(basicsItems[2]), 'lock');
  });

  // ── Completed icon ────────────────────────────

  test('completed exercise shows check icon', async () => {
    store.setCompleted('ex-1');

    const groups = await provider.getChildren();
    const basicsItems = await provider.getChildren(groups[0]);

    assert.strictEqual(getIconId(basicsItems[0]), 'check');
  });

  // ── Skip unlocks next ─────────────────────────

  test('skipping an exercise unlocks the next one', async () => {
    store.setSkipped('ex-1');

    const groups = await provider.getChildren();
    const basicsItems = await provider.getChildren(groups[0]);

    // ex-1 skipped icon
    assert.strictEqual(getIconId(basicsItems[0]), 'dash');

    // ex-2 should be unlocked (ex-1 is skipped)
    assert.notStrictEqual(
      getIconId(basicsItems[1]),
      'lock',
      'ex-2 should be unlocked when ex-1 is skipped',
    );
    assert.ok(hasCommand(basicsItems[1]));
  });

  // ── Skip chain unlocks all ────────────────────

  test('skipping all prerequisites unlocks all exercises', async () => {
    store.setSkipped('ex-1');
    store.setSkipped('ex-2');

    const groups = await provider.getChildren();
    const basicsItems = await provider.getChildren(groups[0]);

    // ex-3 should be unlocked now
    assert.notStrictEqual(
      getIconId(basicsItems[2]),
      'lock',
      'ex-3 should be unlocked when ex-1 and ex-2 are skipped',
    );
    assert.ok(hasCommand(basicsItems[2]));
  });

  // ── Refresh ───────────────────────────────────

  test('refresh() fires onDidChangeTreeData', (done) => {
    const disposable = provider.onDidChangeTreeData(() => {
      disposable.dispose();
      done();
    });

    provider.refresh();
  });
});
