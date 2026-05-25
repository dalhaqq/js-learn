import * as vscode from 'vscode';
import { Exercise, ExerciseProgress, VerificationResult } from '../types';
import { I18N, DIFFICULTY_LABELS } from '../i18n/messages';

/**
 * Cryptographically random nonce for Content-Security-Policy.
 */
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const buf = new Uint32Array(32);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 32; i++) {
    result += chars[buf[i] % chars.length];
  }
  return result;
}



/**
 * ExercisePanel — singleton webview panel for displaying and interacting
 * with JS Learn exercises. Each exercise opens in a reused panel via
 * {@link createOrShow} / {@link revive}.
 *
 * Message-flow:
 *   Webview ─postMessage→ extension (via callbacks: onRun, onSkip, onHint)
 *   Extension ─postMessage→ webview (via showResult, showSolution)
 */
export class ExercisePanel {
  // ──────────────────────────────────────────────
  // Singleton state
  // ──────────────────────────────────────────────

  static currentPanel: ExercisePanel | undefined;

  private static readonly VIEW_TYPE = 'jslearn.exercise';

  // ──────────────────────────────────────────────
  // Singleton factory
  // ──────────────────────────────────────────────

  /**
   * Create a new panel or reveal the existing one for the given exercise.
   * @param extensionUri Root URI of the extension (used to resolve media/ assets).
   * @param exercise The exercise definition to render.
   * @param progress Optional persisted progress for this exercise.
   * @param onRun Called when the user clicks "Jalankan Kode".
   * @param onSkip Called when the user clicks "Lewati".
   * @param onHint Called when the user requests a hint by index.
   * @returns The ExercisePanel instance.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    exercise: Exercise,
    progress: ExerciseProgress | undefined,
    onRun: (code: string) => void,
    onSkip: () => void,
    onHint?: (index: number) => void,
  ): ExercisePanel {
    const column = vscode.ViewColumn.Two;

    if (ExercisePanel.currentPanel) {
      // Reuse existing panel — just update content
      ExercisePanel.currentPanel._panel.reveal(column);
      ExercisePanel.currentPanel._update(exercise, progress);
      ExercisePanel.currentPanel._onRun = onRun;
      ExercisePanel.currentPanel._onSkip = onSkip;
      if (onHint) {
        ExercisePanel.currentPanel._onHint = onHint;
      }
      return ExercisePanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      ExercisePanel.VIEW_TYPE,
      exercise.title,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      },
    );

    ExercisePanel.currentPanel = new ExercisePanel(
      panel,
      extensionUri,
      exercise,
      progress,
      onRun,
      onSkip,
      onHint,
    );

    return ExercisePanel.currentPanel;
  }

  /**
   * Rehydrate a webview panel that was persisted (e.g. after VS Code restart).
   * Call from `onDidChangeWebviewPanels` or `window.registerWebviewPanelSerializer`.
   */
  static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    exercise: Exercise,
    onRun: (code: string) => void,
    onSkip: () => void,
    onHint?: (index: number) => void,
  ): ExercisePanel {
    if (ExercisePanel.currentPanel) {
      ExercisePanel.currentPanel._panel.dispose();
    }

    ExercisePanel.currentPanel = new ExercisePanel(
      panel,
      extensionUri,
      exercise,
      undefined,
      onRun,
      onSkip,
      onHint,
    );

    return ExercisePanel.currentPanel;
  }

  // ──────────────────────────────────────────────
  // Instance
  // ──────────────────────────────────────────────

  private _panel: vscode.WebviewPanel;
  private _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _exercise: Exercise;
  private _onRun: (code: string) => void;
  private _onSkip: () => void;
  private _onHint?: (index: number) => void;

  /** Private constructor — use static factories. */
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    exercise: Exercise,
    progress: ExerciseProgress | undefined,
    onRun: (code: string) => void,
    onSkip: () => void,
    onHint?: (index: number) => void,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._exercise = exercise;
    this._onRun = onRun;
    this._onSkip = onSkip;
    this._onHint = onHint;

    // Set up message listener
    this._panel.webview.onDidReceiveMessage(
      this._handleMessage,
      this,
      this._disposables,
    );

    // Clean up on dispose
    this._panel.onDidDispose(
      () => this.dispose(),
      null,
      this._disposables,
    );

    // Initial render
    this._update(exercise, progress);
  }

  // ──────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────

  /** Post a verification result to the webview. */
  showResult(result: VerificationResult): void {
    this._panel.webview.postMessage({ command: 'showResult', result });
  }

  /** Reveal the solution code in the webview editor. */
  showSolution(solution: string): void {
    this._panel.webview.postMessage({ command: 'showSolution', solution });
  }

  /** Get the currently displayed exercise ID. */
  getExerciseId(): string {
    return this._exercise.id;
  }

  /**
   * Persist editor state across tab switches.
   * Uses `Webview.state` (VS Code 1.74+) via type assertion because
   * `@types/vscode` 1.85 does not expose the property in its typings.
   */
  getState(): Record<string, unknown> {
    return (this._panel.webview as unknown as { state?: Record<string, unknown> }).state ?? {};
  }

  /** Restore editor state. */
  setState(state: Record<string, unknown>): void {
    (this._panel.webview as unknown as { state: Record<string, unknown> }).state = state;
  }

  /** Dispose the panel and unlink from singleton. */
  dispose(): void {
    ExercisePanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  // ──────────────────────────────────────────────
  // Internal: message routing
  // ──────────────────────────────────────────────

  private _handleMessage(message: { command: string; [key: string]: unknown }): void {
    switch (message.command) {
      case 'run':
        this._onRun(String(message.code ?? ''));
        break;
      case 'skip':
        this._onSkip();
        break;
      case 'requestHint':
        if (this._onHint) {
          this._onHint(Number(message.index ?? 0));
        }
        break;
      default:
        // Unknown command — silently ignored
        break;
    }
  }

  // ──────────────────────────────────────────────
  // Internal: render
  // ──────────────────────────────────────────────

  private _update(exercise: Exercise, progress: ExerciseProgress | undefined): void {
    this._exercise = exercise;
    this._panel.title = exercise.title;
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, exercise, progress);
  }

  // ──────────────────────────────────────────────
  // Internal: HTML generation
  // ──────────────────────────────────────────────

  private _getHtmlForWebview(
    webview: vscode.Webview,
    exercise: Exercise,
    progress: ExerciseProgress | undefined,
  ): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'exercise.js'),
    );
    const cmBundleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'codemirror-bundle.js'),
    );

    const resetCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'),
    );
    const vscodeCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'),
    );
    const exerciseCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'exercise.css'),
    );
    const cmCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'codemirror.css'),
    );

    // Convert description (markdown-like) into HTML paragraphs
    const descriptionHtml = this._renderDescription(exercise.description);

    // Render the interaction area based on exercise type
    const interactionHtml = this._renderInteraction(exercise);

    // Render hints as collapsible details elements
    const hintsHtml = this._renderHints(exercise.hints);

    // Progress badge
    const progressBadge = progress?.completed
      ? `<span class="badge badge-completed">${I18N.ui.completed}</span>`
      : progress?.skipped
        ? `<span class="badge badge-skipped">${I18N.ui.skipped}</span>`
        : '';

    return /* html */ `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
  <title>${this._escapeHtml(exercise.title)}</title>
  <link rel="stylesheet" href="${resetCssUri}">
  <link rel="stylesheet" href="${vscodeCssUri}">
  <link rel="stylesheet" href="${exerciseCssUri}">
  <link rel="stylesheet" href="${cmCssUri}">
</head>
<body data-exercise-id="${this._escapeHtml(exercise.id)}" data-exercise-type="${this._escapeHtml(exercise.type)}">
  <div class="exercise-container">
    <header class="exercise-header">
      <h1 class="exercise-title">${this._escapeHtml(exercise.title)}</h1>
      <div class="exercise-meta">
        <span class="difficulty difficulty-${exercise.difficulty}">
          ${DIFFICULTY_LABELS[exercise.difficulty] ?? exercise.difficulty}
        </span>
        ${progressBadge}
      </div>
    </header>

    <section class="exercise-description">
      ${descriptionHtml}
    </section>

    <section class="exercise-interaction">
      ${interactionHtml}
    </section>

    <section class="exercise-actions">
      <button id="btn-run" class="btn btn-primary">${I18N.ui.runButton}</button>
      <button id="btn-skip" class="btn btn-secondary">${I18N.ui.skipButton}</button>
    </section>

    <section class="exercise-output">
      <div id="output-content" class="output-placeholder">// output akan muncul di sini</div>
    </section>

    ${hintsHtml}

    <section class="exercise-result">
      <div id="result"></div>
    </section>
  </div>

  <script nonce="${nonce}" src="${cmBundleUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  // ──────────────────────────────────────────────
  // Internal: description rendering
  // ──────────────────────────────────────────────

  /** Simple markdown-like rendering: blank-line-separated paragraphs. */
  private _renderDescription(markdown: string): string {
    if (!markdown) { return ''; }
    return markdown
      .split(/\n\n+/)
      .map((p) => `<p>${this._escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  }

  // ──────────────────────────────────────────────
  // Internal: interaction area per exercise type
  // ──────────────────────────────────────────────

  private _renderInteraction(exercise: Exercise): string {
    switch (exercise.type) {
      case 'fill-blank':
        return this._renderFillBlank(exercise);
      case 'multiple-choice':
        return this._renderMultipleChoice(exercise);
      case 'write':
      case 'debug':
      default:
        return this._renderCodeEditor(exercise);
    }
  }

  /** Standard code editor for write/debug exercises — CodeMirror 6 container. */
  private _renderCodeEditor(exercise: Exercise): string {
    return `<div id="code-editor"></div>
<script id="initial-code" type="text/plain">${exercise.starterCode.replace(/<\/script>/gi, '<\/script>')}</script>`;
  }

  /** Fill-blank: replace ___BLANK___ placeholders with text inputs. */
  private _renderFillBlank(exercise: Exercise): string {
    // Split starter code on ___BLANK___ markers
    const parts = exercise.starterCode.split('___BLANK___');
    let html = '<div class="fill-blank-code">';
    for (let i = 0; i < parts.length; i++) {
      html += `<span>${this._escapeHtml(parts[i])}</span>`;
      if (i < parts.length - 1) {
        html += `<input type="text" class="blank-input" data-blank-index="${i}" placeholder="...">`;
      }
    }
    html += '</div>';
    return html;
  }

  /** Multiple-choice: render radio buttons from choices[]. */
  private _renderMultipleChoice(exercise: Exercise): string {
    if (!exercise.choices || exercise.choices.length === 0) {
      return '';
    }
    let html = '<div class="multiple-choice">';
    for (let i = 0; i < exercise.choices.length; i++) {
      const ch = exercise.choices[i];
      html += `
        <label class="choice-option">
          <input type="radio" name="mc-answer" value="${this._escapeHtml(ch.value)}" data-choice-index="${i}">
          <span class="choice-label">${['A', 'B', 'C', 'D', 'E'][i] ?? i + 1}. ${this._escapeHtml(ch.label)}</span>
        </label>`;
    }
    html += '</div>';
    return html;
  }

  // ──────────────────────────────────────────────
  // Internal: hints section
  // ──────────────────────────────────────────────

  private _renderHints(hints: string[]): string {
    if (!hints || hints.length === 0) { return ''; }

    let html = '<section class="exercise-hints">';
    html += `<h2 class="hints-title">${I18N.ui.hintLabel}</h2>`;
    for (let i = 0; i < hints.length; i++) {
      html += `
        <details class="hint-detail">
          <summary>${I18N.ui.hintItem(i + 1)}</summary>
          <div class="hint-content">${this._escapeHtml(hints[i])}</div>
        </details>`;
    }
    html += '</section>';
    return html;
  }

  // ──────────────────────────────────────────────
  // Internal: HTML escape utility
  // ──────────────────────────────────────────────

  private _escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
