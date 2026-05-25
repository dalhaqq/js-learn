import * as assert from 'assert';
import * as vscode from 'vscode';
import { DomExercisePanel } from '../../webview/DomExercisePanel';
import { Exercise, ExerciseProgress } from '../../types';

/**
 * Helper: build a minimal DOM exercise for testing.
 */
function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'dom-001',
    type: 'write',
    title: 'Manipulasi DOM',
    description: 'Buat elemen dan tambahkan ke DOM.\n\nGunakan createElement dan appendChild.',
    difficulty: 'easy',
    topic: 'dom',
    prerequisites: ['basics-variables-001'],
    starterCode: '// Tulis kode DOM di sini\nconst el = document.createElement("div");\nel.textContent = "Hello";\ndocument.getElementById("sandbox").appendChild(el);',
    solution: 'const el = document.createElement("div");\nel.textContent = "Hello";\ndocument.getElementById("sandbox").appendChild(el);',
    verification: {
      mode: 'output',
      expectedOutput: '<div>Hello</div>',
    },
    hints: ['Gunakan document.createElement()', 'Gunakan appendChild()'],
    ...overrides,
  };
}

/** Helper: build a progress record. */
function makeProgress(overrides: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    completed: false,
    skipped: false,
    attempts: 0,
    ...overrides,
  };
}

suite('DomExercisePanel', () => {
  let extensionUri: vscode.Uri;

  suiteSetup(async () => {
    const ext = vscode.extensions.all.find(
      (e) =>
        e.id.endsWith('js-learn') ||
        e.packageJSON.name === 'js-learn',
    );
    if (!ext) {
      throw new Error('Extension js-learn not found — cannot determine extensionUri');
    }
    extensionUri = ext.extensionUri;
  });

  teardown(() => {
    if (DomExercisePanel.currentPanel) {
      DomExercisePanel.currentPanel.dispose();
    }
    assert.strictEqual(DomExercisePanel.currentPanel, undefined, 'Singleton not cleaned up');
  });

  // ──────────────────────────────────────────────
  // Singleton pattern
  // ──────────────────────────────────────────────

  test('createOrShow creates a panel and sets singleton', () => {
    const exercise = makeExercise();
    let skipCalled = false;

    const panel = DomExercisePanel.createOrShow(
      extensionUri,
      exercise,
      makeProgress(),
      () => { skipCalled = true; },
    );

    assert.ok(panel, 'Panel instance should be returned');
    assert.strictEqual(DomExercisePanel.currentPanel, panel, 'currentPanel should reference the instance');
    assert.strictEqual(panel.getExerciseId(), 'dom-001', 'getExerciseId should match');
  });

  test('createOrShow reuses existing panel (singleton behavior)', () => {
    const ex1 = makeExercise({ id: 'dom-001', title: 'First' });
    const ex2 = makeExercise({ id: 'dom-002', title: 'Second' });

    const panel1 = DomExercisePanel.createOrShow(
      extensionUri, ex1, makeProgress(),
      () => {},
    );

    const panel2 = DomExercisePanel.createOrShow(
      extensionUri, ex2, makeProgress(),
      () => {},
    );

    assert.strictEqual(panel2, panel1, 'Second createOrShow should return same instance');
    assert.strictEqual(DomExercisePanel.currentPanel, panel1, 'Singleton still references same panel');
    assert.strictEqual(panel2.getExerciseId(), 'dom-002', 'Exercise should update to second one');
  });

  // ──────────────────────────────────────────────
  // HTML generation — structural elements
  // ──────────────────────────────────────────────

  test('webview HTML contains sandbox div and required elements', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;

    // Sandbox div
    assert.ok(html.includes('id="sandbox"'), 'Sandbox div should be present');
    assert.ok(html.includes('Area DOM'), 'Sandbox label "Area DOM" should be present');

    // Sandbox result area
    assert.ok(html.includes('id="sandbox-result"'), 'Sandbox result div should be present');
    assert.ok(html.includes('Hasil DOM'), 'Sandbox result label "Hasil DOM" should be present');

    // Title
    assert.ok(html.includes('<h1 class="exercise-title">Manipulasi DOM</h1>'), 'Title <h1> should be present');

    // Difficulty badge
    assert.ok(html.includes('difficulty-easy'), 'Easy difficulty class should be present');
    assert.ok(html.includes('Mudah'), 'Difficulty label "Mudah" should be present');

    // Description
    assert.ok(html.includes('Buat elemen dan tambahkan ke DOM'), 'Description text should be present');

    // Code editor
    assert.ok(html.includes('id="code-editor"'), 'Code editor textarea should be present');
    assert.ok(html.includes('createElement'), 'Starter code should be in the editor');

    // Buttons
    assert.ok(html.includes('id="btn-run"'), 'Run button should be present');
    assert.ok(html.includes('id="btn-skip"'), 'Skip button should be present');
    assert.ok(html.includes('Jalankan DOM'), 'Run button should have "Jalankan DOM" label');
    assert.ok(html.includes('Lewati'), 'Skip button should have "Lewati" label');

    // Hints section
    assert.ok(html.includes('Petunjuk'), 'Hints section title should be present');
    assert.ok(html.includes('<details class="hint-detail">'), 'Collapsible hints should be present');
    assert.ok(html.includes('Gunakan document.createElement()'), 'First hint text should be present');

    // Result area
    assert.ok(html.includes('id="result"'), 'Result div should be present');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // CSP meta tag — nonce and unsafe-inline
  // ──────────────────────────────────────────────

  test('CSP meta tag contains nonce and allows unsafe-inline for scripts', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;

    // Check CSP meta tag
    assert.ok(
      html.includes('Content-Security-Policy'),
      'CSP meta tag should be present',
    );
    assert.ok(
      html.includes("default-src 'none'"),
      'CSP should restrict default-src',
    );

    // Verify script-src includes both unsafe-inline and unsafe-eval
    assert.ok(
      html.includes("'unsafe-inline'"),
      "CSP script-src should allow 'unsafe-inline'",
    );
    assert.ok(
      html.includes("'unsafe-eval'"),
      "CSP script-src should allow 'unsafe-eval' for learner code",
    );

    // Verify nonce format: script-src 'nonce-<alphanumeric>' (at least 8 chars)
    const nonceMatch = html.match(/script-src\s+'nonce-([A-Za-z0-9]+)'/);
    assert.ok(nonceMatch, 'CSP should include script-src nonce');
    if (nonceMatch) {
      const nonce = nonceMatch[1];
      assert.ok(nonce.length >= 8, `Nonce should be >= 8 chars, got ${nonce.length}`);
      // Nonce should appear in script tag too
      assert.ok(
        html.includes(`nonce="${nonce}"`),
        'Nonce in CSP should match nonce in script tag',
      );
    }

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Script reference: dom-sandbox.js
  // ──────────────────────────────────────────────

  test('getHtmlForWebview includes dom-sandbox.js script reference', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;

    // Should reference dom-sandbox.js (NOT exercise.js)
    assert.ok(html.includes('dom-sandbox.js'), 'Script tag should reference dom-sandbox.js');

    // Should NOT reference exercise.js (that's for the other panel type)
    assert.ok(!html.includes('exercise.js'), 'Should not reference exercise.js (separate panel)');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Message handler: skip
  // ──────────────────────────────────────────────

  test('message handler routes skip command to onSkip callback', () => {
    const exercise = makeExercise({ id: 'dom-skip-test' });
    let skipCalled = false;

    const panel = DomExercisePanel.createOrShow(
      extensionUri,
      exercise,
      makeProgress(),
      () => { skipCalled = true; },
    );

    // Simulate incoming 'skip' message from webview
    const webview = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview;
    const onDidReceiveMessage = (webview as unknown as {
      _onDidReceiveMessage?: { fire: (msg: object) => void };
    })._onDidReceiveMessage;

    if (onDidReceiveMessage?.fire) {
      onDidReceiveMessage.fire({ command: 'skip' });
      assert.ok(skipCalled, 'onSkip should be called when skip message received');
    }

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Edge case: no hints
  // ──────────────────────────────────────────────

  test('exercise with no hints does not render hints section', () => {
    const exercise = makeExercise({ id: 'dom-nohint', hints: [] });
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;
    assert.ok(!html.includes('exercise-hints'), 'No hints section when hints array is empty');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Edge case: empty description
  // ──────────────────────────────────────────────

  test('exercise with empty description renders without description section', () => {
    const exercise = makeExercise({ id: 'dom-nodesc', description: '' });
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;
    // Description section should still exist in structure but be empty
    assert.ok(html.includes('exercise-description'), 'Description section exists but empty');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Edge case: exercise without blanks/choices (DOM only)
  // ──────────────────────────────────────────────

  test('DOM exercise without blanks or choices renders correctly', () => {
    const exercise = makeExercise({
      id: 'dom-pure',
      starterCode: 'const d = document.getElementById("sandbox");\nd.innerHTML = "<span>test</span>";',
      solution: 'const d = document.getElementById("sandbox");\nd.innerHTML = "<span>test</span>";',
    });
    // Ensure no blanks or choices
    assert.strictEqual(exercise.blanks, undefined, 'DOM exercise should have no blanks');
    assert.strictEqual(exercise.choices, undefined, 'DOM exercise should have no choices');

    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;

    // Should render as a normal write-type exercise (code editor, not blank inputs or radio buttons)
    assert.ok(html.includes('id="code-editor"'), 'Should render code editor');
    assert.ok(!html.includes('blank-input'), 'Should not have blank inputs');
    assert.ok(!html.includes('multiple-choice'), 'Should not have multiple-choice container');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Difficulty labels (Indonesian)
  // ──────────────────────────────────────────────

  test('difficulty labels are in Indonesian', () => {
    const easyExercise = makeExercise({ id: 'ez', difficulty: 'easy' });
    const mediumExercise = makeExercise({ id: 'md', difficulty: 'medium' });
    const hardExercise = makeExercise({ id: 'hd', difficulty: 'hard' });

    const panel = DomExercisePanel.createOrShow(
      extensionUri, easyExercise, makeProgress(),
      () => {},
    );
    let html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;
    assert.ok(html.includes('Mudah'), 'Easy → Mudah');

    DomExercisePanel.createOrShow(
      extensionUri, mediumExercise, makeProgress(),
      () => {},
    );
    html = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;
    assert.ok(html.includes('Sedang'), 'Medium → Sedang');

    DomExercisePanel.createOrShow(
      extensionUri, hardExercise, makeProgress(),
      () => {},
    );
    html = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;
    assert.ok(html.includes('Sulit'), 'Hard → Sulit');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Progress badges
  // ──────────────────────────────────────────────

  test('completed exercise shows badge', () => {
    const exercise = makeExercise({ id: 'dom-done' });
    const progress = makeProgress({ completed: true, attempts: 2 });
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, progress,
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;
    assert.ok(html.includes('badge-completed'), 'Completed badge CSS class should be present');
    assert.ok(html.includes('Selesai'), 'Completed badge with "Selesai" label');

    panel.dispose();
  });

  test('skipped exercise shows badge', () => {
    const exercise = makeExercise({ id: 'dom-skip' });
    const progress = makeProgress({ skipped: true });
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, progress,
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;
    assert.ok(html.includes('badge-skipped'), 'Skipped badge CSS class should be present');
    assert.ok(html.includes('Lewat'), 'Skipped badge with "Lewat" label');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // HTML escaping (security)
  // ──────────────────────────────────────────────

  test('HTML special characters in exercise title are escaped', () => {
    const exercise = makeExercise({
      id: 'dom-xss',
      title: 'Test <script>alert("xss")</script>',
      description: 'Coba <img onerror="alert(1)"> dalam DOM.',
    });
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const html: string = (panel as unknown as { _panel: vscode.WebviewPanel })._panel.webview.html;

    assert.ok(!html.includes('<script>alert'), 'Script tags in title should be escaped');
    assert.ok(html.includes('&lt;script&gt;'), 'Script tags should be HTML-escaped');
    assert.ok(html.includes('&lt;img'), 'HTML tags in description should be escaped');

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // Public API: showResult, showSolution, reveal
  // ──────────────────────────────────────────────

  test('showResult does not throw', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    assert.doesNotThrow(() => {
      panel.showResult({ passed: true, message: 'Berhasil! DOM sesuai.' });
    });

    assert.doesNotThrow(() => {
      panel.showResult({
        passed: false,
        message: 'DOM tidak sesuai.',
        details: 'Diharapkan:\n<div>Hello</div>\n\nDidapatkan:\n<div>World</div>',
      });
    });

    panel.dispose();
  });

  test('showSolution does not throw', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    assert.doesNotThrow(() => {
      panel.showSolution('const el = document.createElement("div");');
    });

    panel.dispose();
  });

  test('reveal does not throw', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    assert.doesNotThrow(() => {
      panel.reveal();
    });

    panel.dispose();
  });

  // ──────────────────────────────────────────────
  // getState / setState
  // ──────────────────────────────────────────────

  test('getState returns webview state', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const state = panel.getState();
    assert.ok(typeof state === 'object', 'getState should return an object');
    assert.deepStrictEqual(state, {}, 'Initial state should be empty');

    panel.dispose();
  });

  test('setState persists webview state', () => {
    const exercise = makeExercise();
    const panel = DomExercisePanel.createOrShow(
      extensionUri, exercise, makeProgress(),
      () => {},
    );

    const testState = { code: 'document.getElementById("sandbox").innerHTML = "<b>test</b>";' };
    assert.doesNotThrow(() => {
      panel.setState(testState);
    });

    const retrieved = panel.getState();
    assert.deepStrictEqual(retrieved, testState, 'getState should return what setState persisted');

    panel.dispose();
  });
});
