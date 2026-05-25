/**
 * @file LessonTreeProvider — VS Code TreeView for the curriculum sidebar.
 *
 * Displays lesson groups as collapsible nodes and exercises as leaf nodes.
 * Lock/unlock logic: first exercise per group is always unlocked;
 * subsequent exercises are unlocked only when all prerequisites are
 * completed or skipped.
 *
 * Design decisions:
 * - Delegates progress queries to ProgressStore (injected dependency).
 * - Delegates exercise data to ExerciseProvider (injected dependency).
 * - No synchronous file I/O — everything is cached by the providers.
 * - Uses EventEmitter for the standard VS Code refresh mechanism.
 */

import * as vscode from 'vscode';
import { Exercise, ExerciseProvider, ExerciseProgress, LessonGroup } from '../types';

// ──────────────────────────────────────────────
// ProgressStore contract (consumed by this provider)
// ──────────────────────────────────────────────

/**
 * Minimal interface describing what LessonTreeProvider needs
 * from a ProgressStore. Task 5 (ProgressStore) will implement
 * this contract.
 */
export interface ProgressStore {
  isCompleted(exerciseId: string): boolean;
  getProgress(exerciseId: string): ExerciseProgress | undefined;
}

// ──────────────────────────────────────────────
// Tree item
// ──────────────────────────────────────────────

export class LessonTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly group?: LessonGroup,
    public readonly exercise?: Exercise,
  ) {
    super(label, collapsibleState);

    // Only exercise-level items get the 'lesson' contextValue
    if (exercise) {
      this.contextValue = 'lesson';
    }
  }
}

// ──────────────────────────────────────────────
// Tree data provider
// ──────────────────────────────────────────────

export class LessonTreeProvider implements vscode.TreeDataProvider<LessonTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<LessonTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly exerciseProvider: ExerciseProvider,
    private readonly progressStore: ProgressStore,
  ) {}

  // ── TreeDataProvider contract ────────────────────

  getTreeItem(element: LessonTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: LessonTreeItem): Promise<LessonTreeItem[]> {
    // Root level → return one item per LessonGroup
    if (!element) {
      const groups = await this.exerciseProvider.getLessonGroups();
      return groups.map(
        (g) =>
          new LessonTreeItem(
            g.title,
            vscode.TreeItemCollapsibleState.Collapsed,
            g,
          ),
      );
    }

    // Group level → return exercise items for that group
    if (element.group) {
      const exercises: Exercise[] = [];
      for (const id of element.group.exercises) {
        const ex = await this.exerciseProvider.getExercise(id);
        if (ex) exercises.push(ex);
      }

      return exercises.map((ex, index) => {
        const isFirst = index === 0;
        const isLocked = !isFirst && !this.arePrerequisitesMet(ex);

        const item = new LessonTreeItem(
          ex.title,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          ex,
        );

        if (isLocked) {
          item.iconPath = new vscode.ThemeIcon('lock');
        } else {
          item.iconPath = this.resolveExerciseIcon(ex.id);
          item.command = {
            command: 'jslearn.openExercise',
            title: 'Buka Latihan',
            arguments: [ex.id],
          };
        }

        return item;
      });
    }

    return [];
  }

  // ── Lock / unlock logic ──────────────────────────

  /**
   * Returns true when every prerequisite of `exercise` has been
   * completed or skipped by the learner.
   */
  private arePrerequisitesMet(exercise: Exercise): boolean {
    if (!exercise.prerequisites || exercise.prerequisites.length === 0) {
      return true;
    }

    return exercise.prerequisites.every((preId) => {
      const progress = this.progressStore.getProgress(preId);
      return progress?.completed === true || progress?.skipped === true;
    });
  }

  // ── Icon resolution ──────────────────────────────

  private resolveExerciseIcon(exerciseId: string): vscode.ThemeIcon {
    const progress = this.progressStore.getProgress(exerciseId);
    if (progress?.completed) return new vscode.ThemeIcon('check');
    if (progress?.skipped) return new vscode.ThemeIcon('dash');
    return new vscode.ThemeIcon('circle-outline');
  }

  // ── Refresh ──────────────────────────────────────

  /**
   * Signal the TreeView to re-query getChildren for every node.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
