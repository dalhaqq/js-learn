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
 * Whitespace-tolerant normalization matching OutputVerifier behavior.
 * CRLF → LF, strip trailing whitespace per line, collapse 3+ blank lines → 2, trim.
 */
function normalize(str: string): string {
  return str
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * DomExercisePanel — singleton webview panel for DOM manipulation exercises.
 *
 * Learners write browser DOM API code (querySelector, createElement,
 * addEventListener) that executes in a real webview sandbox. The DOM
 * state is captured after execution and compared against the expected
 * output for verification.
 *
 * Message-flow:
 *   Webview ─postMessage→ extension:  runDom, skip, domResult
 *   Extension ─postMessage→ webview: executeDom, showResult, showSolution
 *
 * Separate from ExercisePanel (VIEW_TYPE 'jslearn.exercise') —
 * uses VIEW_TYPE 'jslearn.domExercise'.
 */
export class DomExercisePanel {
  // ──────────────────────────────────────────────
  // Singleton state
  // ──────────────────────────────────────────────

  static currentPanel: DomExercisePanel | undefined;

  private static readonly VIEW_TYPE = 'jslearn.domExercise';

  // ──────────────────────────────────────────────
  // Singleton factory
  // ──────────────────────────────────────────────

  /**
   * Create a new panel or reveal the existing one for the given DOM exercise.
   * @param extensionUri Root URI of the extension (used to resolve media/ assets).
   * @param exercise The DOM exercise definition to render.
   * @param progress Optional persisted progress for this exercise.
   * @param onSkip Called when the user clicks "Lewati".
   * @returns The DomExercisePanel instance.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    exercise: Exercise,
    progress: ExerciseProgress | undefined,
    onSkip: () => void,
  ): DomExercisePanel {
    const column = vscode.ViewColumn.Two;

    if (DomExercisePanel.currentPanel) {
      // Reuse existing panel — just update content
      DomExercisePanel.currentPanel._panel.reveal(column);
      DomExercisePanel.currentPanel._update(exercise, progress);
      DomExercisePanel.currentPanel._onSkip = onSkip;
      return DomExercisePanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      DomExercisePanel.VIEW_TYPE,
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

    DomExercisePanel.currentPanel = new DomExercisePanel(
      panel,
      extensionUri,
      exercise,
      progress,
      onSkip,
    );

    return DomExercisePanel.currentPanel;
  }

  /**
   * Rehydrate a webview panel that was persisted (e.g. after VS Code restart).
   * Call from `window.registerWebviewPanelSerializer`.
   */
  static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    exercise: Exercise,
    onSkip: () => void,
  ): DomExercisePanel {
    if (DomExercisePanel.currentPanel) {
      DomExercisePanel.currentPanel._panel.dispose();
    }

    DomExercisePanel.currentPanel = new DomExercisePanel(
      panel,
      extensionUri,
      exercise,
      undefined,
      onSkip,
    );

    return DomExercisePanel.currentPanel;
  }

  // ──────────────────────────────────────────────
  // Instance
  // ──────────────────────────────────────────────

  private _panel: vscode.WebviewPanel;
  private _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _exercise: Exercise;
  private _onSkip: () => void;

  /** Private constructor — use static factories. */
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    exercise: Exercise,
    progress: ExerciseProgress | undefined,
    onSkip: () => void,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._exercise = exercise;
    this._onSkip = onSkip;

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

  /** Make the panel visible. */
  reveal(): void {
    this._panel.reveal();
  }

  /** Dispose the panel and unlink from singleton. */
  dispose(): void {
    DomExercisePanel.currentPanel = undefined;
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
      case 'runDom': {
        // Learner clicked "Jalankan DOM" — send code to webview to execute in sandbox
        const code = String(message.code ?? '');
        this._panel.webview.postMessage({ command: 'executeDom', code });
        break;
      }
      case 'domResult': {
        // Webview executed learner code — compare DOM state with expected
        const domState = String(message.domState ?? '');
        const expected = this._exercise.verification.expectedOutput ?? '';

        const normalizedActual = normalize(domState);
        const normalizedExpected = normalize(expected);

        if (normalizedActual === normalizedExpected) {
          this.showResult({
            passed: true,
            message: I18N.verification.passDom,
          });
        } else {
          this.showResult({
            passed: false,
            message: I18N.verification.failDom,
            details: `${I18N.verification.expectedLabel}\n${expected}\n\n${I18N.verification.actualLabel}\n${domState}`,
          });
        }
        break;
      }
      case 'skip':
        this._onSkip();
        this.showSolution(this._exercise.solution);
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
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dom-sandbox.js'),
    );
    const cmBundleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'codemirror-bundle.js'),
    );
    const cmCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'codemirror.css'),
    );

    // Convert description (markdown-like) into HTML paragraphs
    const descriptionHtml = this._renderDescription(exercise.description);

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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'; img-src ${webview.cspSource} https:;">
  <title>${this._escapeHtml(exercise.title)}</title>
  <link rel="stylesheet" href="${cmCssUri}">
  <style>
    ${this._getBaseStyles()}
  </style>
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

    <section class="exercise-sandbox">
      <h2 class="sandbox-label">${I18N.ui.sandboxLabel}</h2>
      <div id="sandbox"></div>
    </section>

    <section class="exercise-interaction">
      <div id="code-editor"></div>
      <script id="initial-code" type="text/plain">${exercise.starterCode.replace(/<\/script>/gi, '<\/script>')}</script>
    </section>

    <section class="exercise-actions">
      <button id="btn-run" class="btn btn-primary">${I18N.ui.runDomButton}</button>
      <button id="btn-skip" class="btn btn-secondary">${I18N.ui.skipButton}</button>
    </section>

    <section class="exercise-output">
      <div id="output-content" class="output-placeholder">// output akan muncul di sini</div>
    </section>

    ${hintsHtml}

    <section class="exercise-result">
      <div id="result"></div>
    </section>

    <section class="exercise-sandbox-result">
      <h2 class="sandbox-result-label">${I18N.ui.domResultLabel}</h2>
      <div id="sandbox-result"></div>
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
  // Internal: CSS (inline — no external frameworks)
  // ──────────────────────────────────────────────

  private _getBaseStyles(): string {
    return /* css */ `
      :root {
        --color-bg: var(--vscode-editor-background, #1e1e1e);
        --color-fg: var(--vscode-editor-foreground, #d4d4d4);
        --color-primary: var(--vscode-button-background, #007acc);
        --color-primary-fg: var(--vscode-button-foreground, #ffffff);
        --color-secondary: var(--vscode-button-secondaryBackground, #3a3d41);
        --color-secondary-fg: var(--vscode-button-secondaryForeground, #cccccc);
        --color-border: var(--vscode-panel-border, #3c3c3c);
        --color-input-bg: var(--vscode-input-background, #3c3c3c);
        --color-input-fg: var(--vscode-input-foreground, #cccccc);
        --color-sandbox-bg: var(--vscode-textBlockQuote-background, #2a2a2a);
        --color-success: #4ec9b0;
        --color-error: #f14c4c;
        --color-warning: #cca700;
        --color-easy: #4ec9b0;
        --color-medium: #cca700;
        --color-hard: #f14c4c;
        --radius: 6px;
        --gap: 16px;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: var(--vscode-font-family, -apple-system, sans-serif);
        font-size: var(--vscode-font-size, 13px);
        color: var(--color-fg);
        background: var(--color-bg);
        line-height: 1.6;
        padding: 0;
      }

      .exercise-container {
        max-width: 800px;
        margin: 0 auto;
        padding: var(--gap);
      }

      .exercise-header {
        margin-bottom: var(--gap);
        padding-bottom: var(--gap);
        border-bottom: 1px solid var(--color-border);
      }

      .exercise-title {
        font-size: 1.5em;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .exercise-meta {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .difficulty {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .difficulty-easy {
        background: rgba(78, 201, 176, 0.15);
        color: var(--color-easy);
        border: 1px solid var(--color-easy);
      }

      .difficulty-medium {
        background: rgba(204, 167, 0, 0.15);
        color: var(--color-medium);
        border: 1px solid var(--color-medium);
      }

      .difficulty-hard {
        background: rgba(241, 76, 76, 0.15);
        color: var(--color-hard);
        border: 1px solid var(--color-hard);
      }

      .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: 500;
      }

      .badge-completed {
        background: rgba(78, 201, 176, 0.15);
        color: var(--color-success);
      }

      .badge-skipped {
        background: rgba(204, 167, 0, 0.15);
        color: var(--color-warning);
      }

      .exercise-description {
        margin-bottom: var(--gap);
      }

      .exercise-description p {
        margin-bottom: 8px;
      }

      .exercise-sandbox {
        margin-bottom: var(--gap);
      }

      .sandbox-label {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--color-fg);
        opacity: 0.7;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #sandbox {
        min-height: 120px;
        padding: 12px;
        background: var(--color-sandbox-bg);
        border: 1px dashed var(--color-border);
        border-radius: var(--radius);
        font-family: var(--vscode-font-family, -apple-system, sans-serif);
        font-size: var(--vscode-font-size, 13px);
        line-height: 1.6;
      }

      .exercise-interaction {
        margin-bottom: var(--gap);
      }

      #code-editor {
        margin-bottom: 16px;
      }

      /* CodeMirror border and focus */
      .cm-editor {
        border: 1px solid var(--color-input-border, var(--vscode-input-border, #3c3c3c));
        border-radius: var(--radius, 4px);
      }

      .cm-editor.cm-focused {
        border-color: var(--color-primary, var(--vscode-focusBorder, #007acc));
      }

      /* ── Code Output (stdout terminal display) ──────────────────────── */
      .exercise-output {
        margin-top: var(--gap, 16px);
      }

      #output-content {
        padding: 10px 14px;
        min-height: 40px;
        font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
        font-size: var(--vscode-editor-font-size, 13px);
        color: var(--vscode-terminal-foreground, #cccccc);
        background-color: var(--vscode-terminal-background, #1e1e1e);
        border: 1px solid var(--color-border, var(--vscode-panel-border, #3c3c3c));
        border-radius: var(--radius, 4px);
        white-space: pre-wrap;
        overflow-wrap: break-word;
      }

      .output-placeholder {
        color: var(--vscode-input-placeholderForeground, #777) !important;
        font-style: italic;
      }

      .exercise-actions {
        display: flex;
        gap: 8px;
        margin-bottom: var(--gap);
      }

      .btn {
        padding: 6px 16px;
        border: none;
        border-radius: var(--radius);
        font-size: inherit;
        font-family: inherit;
        cursor: pointer;
        font-weight: 500;
        transition: opacity 0.15s;
      }

      .btn:hover {
        opacity: 0.9;
      }

      .btn:active {
        opacity: 0.75;
      }

      .btn-primary {
        background: var(--color-primary);
        color: var(--color-primary-fg);
      }

      .btn-secondary {
        background: var(--color-secondary);
        color: var(--color-secondary-fg);
      }

      .exercise-hints {
        margin-bottom: var(--gap);
      }

      .hints-title {
        font-size: 1.1em;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .hint-detail {
        margin-bottom: 4px;
      }

      .hint-detail summary {
        cursor: pointer;
        padding: 4px 0;
        color: var(--color-primary);
        font-weight: 500;
      }

      .hint-detail summary:hover {
        text-decoration: underline;
      }

      .hint-content {
        padding: 8px 12px;
        margin-top: 4px;
        background: var(--color-input-bg);
        border-left: 3px solid var(--color-primary);
        border-radius: 0 var(--radius) var(--radius) 0;
      }

      .exercise-result {
        margin-bottom: var(--gap);
        padding-top: var(--gap);
        border-top: 1px solid var(--color-border);
      }

      .result-pass {
        padding: 8px 12px;
        background: rgba(78, 201, 176, 0.1);
        border: 1px solid var(--color-success);
        border-radius: var(--radius);
        color: var(--color-success);
        font-weight: 500;
      }

      .result-fail {
        padding: 8px 12px;
        background: rgba(241, 76, 76, 0.1);
        border: 1px solid var(--color-error);
        border-radius: var(--radius);
        color: var(--color-error);
        font-weight: 500;
      }

      .result-fail pre {
        margin-top: 8px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        font-size: 0.9em;
        white-space: pre-wrap;
        overflow-wrap: break-word;
      }

      .exercise-sandbox-result {
        margin-top: var(--gap);
        padding-top: var(--gap);
        border-top: 1px solid var(--color-border);
      }

      .sandbox-result-label {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--color-fg);
        opacity: 0.7;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #sandbox-result {
        min-height: 60px;
        padding: 12px;
        background: var(--color-sandbox-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
        font-size: var(--vscode-editor-font-size, 13px);
        white-space: pre-wrap;
        overflow-wrap: break-word;
      }
    `;
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
