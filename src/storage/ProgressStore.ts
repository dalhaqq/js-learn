import * as vscode from 'vscode';
import { I18N } from '../i18n/messages';
import { ProgressFile, ExerciseProgress } from '../types';

/**
 * ProgressStore — local JSON progress tracking via VS Code globalState.
 *
 * Design:
 * - Uses `context.globalState` (Memento API) for atomic serialization.
 * - On corrupted data: backs up to `storageUri`, shows Indonesian warning,
 *   returns fresh ProgressFile. Never throws.
 * - Schema migration: checks `schemaVersion` on load.
 */
export class ProgressStore {
  private static readonly STORAGE_KEY = 'jslearn.progress';

  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // ──────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────

  /**
   * Load progress from globalState.
   * Returns default ProgressFile if none exists or data is corrupted.
   */
  load(): ProgressFile {
    try {
      const raw = this.context.globalState.get<ProgressFile>(
        ProgressStore.STORAGE_KEY
      );

      if (!raw) {
        return this.createDefaultProgress();
      }

      // Schema migration check
      let progress = raw;
      if (progress.schemaVersion < 1) {
        progress = this.migrateV1toV2(progress);
      }

      // Defensive: ensure exercises field exists
      if (!progress.exercises) {
        progress.exercises = {};
      }

      progress.lastUpdated = new Date().toISOString();
      return progress;
    } catch (err) {
      return this.handleCorruptedData(err);
    }
  }

  /**
   * Persist progress to globalState and create a JSON backup file.
   */
  async save(progress: ProgressFile): Promise<void> {
    progress.lastUpdated = new Date().toISOString();
    await this.context.globalState.update(
      ProgressStore.STORAGE_KEY,
      progress
    );

    // Backup to storageUri
    if (this.context.storageUri) {
      try {
        const backupUri = vscode.Uri.joinPath(
          this.context.storageUri,
          'progress-backup.json'
        );
        await vscode.workspace.fs.writeFile(
          backupUri,
          Buffer.from(JSON.stringify(progress, null, 2), 'utf8')
        );
      } catch {
        // Backup failure should not block save
      }
    }
  }

  /**
   * Mark an exercise as completed — increments attempts.
   */
  async markCompleted(id: string): Promise<void> {
    const progress = this.load();
    const current = progress.exercises[id];

    progress.exercises[id] = {
      completed: true,
      skipped: false,
      completedAt: new Date().toISOString(),
      attempts: (current?.attempts ?? 0) + 1,
    };

    await this.save(progress);
  }

  /**
   * Mark an exercise as skipped — does not increment attempts.
   */
  async markSkipped(id: string): Promise<void> {
    const progress = this.load();
    const current = progress.exercises[id];

    progress.exercises[id] = {
      completed: false,
      skipped: true,
      completedAt: new Date().toISOString(),
      attempts: current?.attempts ?? 0,
    };

    await this.save(progress);
  }

  /**
   * Check whether a specific exercise has been completed.
   */
  isCompleted(id: string): boolean {
    const progress = this.load();
    return progress.exercises[id]?.completed ?? false;
  }

  /**
   * Get progress for a single exercise (or undefined).
   */
  getProgress(id: string): ExerciseProgress | undefined {
    const progress = this.load();
    return progress.exercises[id];
  }

  /**
   * Get a shallow copy of all exercise progress records.
   */
  getAllProgress(): Record<string, ExerciseProgress> {
    const progress = this.load();
    return { ...progress.exercises };
  }

  /**
   * Delete all persisted progress data.
   */
  async reset(): Promise<void> {
    await this.context.globalState.update(
      ProgressStore.STORAGE_KEY,
      undefined
    );
  }

  // ──────────────────────────────────────────────
  // Schema migration
  // ──────────────────────────────────────────────

  /**
   * Placeholder for future V1 → V2 schema migration.
   */
  private migrateV1toV2(_progress: ProgressFile): ProgressFile {
    // Future: transform exercise records, rename fields, etc.
    return this.createDefaultProgress();
  }

  // ──────────────────────────────────────────────
  // Error recovery
  // ──────────────────────────────────────────────

  private createDefaultProgress(): ProgressFile {
    return {
      schemaVersion: 1,
      exercises: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  private handleCorruptedData(_err: unknown): ProgressFile {
    // Attempt to back up the corrupted data before resetting
    try {
      const raw = this.context.globalState.get(ProgressStore.STORAGE_KEY);
      if (raw && this.context.storageUri) {
        const backupUri = vscode.Uri.joinPath(
          this.context.storageUri,
          `progress-corrupted-${Date.now()}.json`
        );
        vscode.workspace.fs.writeFile(
          backupUri,
          Buffer.from(JSON.stringify(raw, null, 2), 'utf8')
        );
      }
    } catch {
      // Backup failure is non-fatal
    }

    vscode.window.showWarningMessage(I18N.progress.corrupted);
    return this.createDefaultProgress();
  }
}
