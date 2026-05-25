/**
 * dom-sandbox.js — Webview-side sandbox script for DOM exercise panel.
 *
 * Runs inside the webview sandbox. Communicates with the extension host
 * via the VS Code webview API (acquireVsCodeApi).
 *
 * Features:
 *  - CodeMirror 6 editor with JavaScript syntax highlighting
 *  - Sandbox <div id="sandbox"> where learner DOM code executes
 *  - Run / Skip button wiring (postMessage to extension)
 *  - DOM state capture after code execution
 *  - Result display (pass/fail with details)
 *  - Solution reveal
 *  - State persistence across tab switches (vscode.getState/setState)
 */
(function () {
  // eslint-disable-next-line no-undef
  var vscode = acquireVsCodeApi();
  var previousState = vscode.getState() || {};
  var currentExerciseId = document.body.dataset.exerciseId || '';

  // Clear stale editor state when switching to a different exercise
  if (previousState.exerciseId && previousState.exerciseId !== currentExerciseId) {
    previousState.code = null;
    previousState.blanks = null;
    previousState.choice = null;
  }
  previousState.exerciseId = currentExerciseId;
  vscode.setState(previousState);

  // ──────────────────────────────────────────────
  // CodeMirror 6 initialization
  // ──────────────────────────────────────────────

  var editorView = null;
  var editorContainer = document.getElementById('code-editor');
  var initialCodeTag = document.getElementById('initial-code');

  if (editorContainer && initialCodeTag && typeof CodeMirrorBundle !== 'undefined') {
    var CM = CodeMirrorBundle;
    var initialCode = initialCodeTag.textContent || '';

    // Listen for changes and persist to webview state
    var updateListener = CM.EditorView.updateListener.of(function (update) {
      if (update.docChanged) {
        previousState.code = update.state.doc.toString();
        vscode.setState(previousState);
      }
    });

    editorView = new CM.EditorView({
      doc: previousState.code || initialCode,
      extensions: [CM.basicSetup, CM.javascript(), CM.vscodeDark, updateListener],
      parent: editorContainer,
    });
  }

  // ──────────────────────────────────────────────
  // Buttons: run and skip
  // ──────────────────────────────────────────────

  var btnRun = document.getElementById('btn-run');
  if (btnRun) {
    btnRun.addEventListener('click', function () {
      var code = editorView ? editorView.state.doc.toString() : '';
      vscode.postMessage({ command: 'runDom', code: code });
    });
  }

  var btnSkip = document.getElementById('btn-skip');
  if (btnSkip) {
    btnSkip.addEventListener('click', function () {
      vscode.postMessage({
        command: 'skip',
        exerciseId: document.body.dataset.exerciseId || '',
      });
    });
  }

  // ──────────────────────────────────────────────
  // Handle messages from extension
  // ──────────────────────────────────────────────

  window.addEventListener('message', function (event) {
    var msg = event.data;
    var resultDiv = document.getElementById('result');
    var sandboxResult = document.getElementById('sandbox-result');
    var outputContent = document.getElementById('output-content');

    switch (msg.command) {
      case 'executeDom': {
        // Reset sandbox to empty state
        var sandbox = document.getElementById('sandbox');
        if (sandbox) {
          sandbox.innerHTML = '';
        }

        // Execute learner code in try/catch, capturing sandbox DOM after
        var domState = '';
        try {
          // The learner code is eval'd in the webview context so it has
          // full access to the real browser DOM APIs (document.* methods).
          eval(msg.code);
        } catch (err) {
          domState = 'Error: ' + (err && err.message ? err.message : String(err));
        }

        // Capture sandbox DOM state AFTER execution (only if no error above)
        if (!domState && sandbox) {
          domState = sandbox.innerHTML;
        }

        // Show captured DOM in the result area
        if (sandboxResult) {
          sandboxResult.textContent = domState || '(DOM kosong)';
        }

        // Send DOM state back to extension for verification
        vscode.postMessage({ command: 'domResult', domState: domState });
        break;
      }

      case 'showResult':
        // Display stdout output
        if (outputContent) {
          if (msg.result && msg.result.output) {
            outputContent.textContent = msg.result.output;
            outputContent.classList.remove('output-placeholder');
          } else {
            outputContent.textContent = '// output akan muncul di sini';
            outputContent.classList.add('output-placeholder');
          }
        }

        // Display pass/fail result
        if (!resultDiv) { return; }
        if (msg.result.passed) {
          resultDiv.innerHTML =
            '<div class="result-pass">✅ ' +
            escapeHtml(msg.result.message) +
            '</div>';
        } else {
          var html =
            '<div class="result-fail">❌ ' +
            escapeHtml(msg.result.message);
          if (msg.result.details) {
            html += '<pre>' + escapeHtml(msg.result.details) + '</pre>';
          }
          html += '</div>';
          resultDiv.innerHTML = html;
        }
        break;

      case 'showSolution':
        if (!editorView) { return; }
        editorView.dispatch({
          changes: { from: 0, to: editorView.state.doc.length, insert: msg.solution },
        });
        previousState.code = msg.solution;
        vscode.setState(previousState);
        break;

      default:
        break;
    }
  });

  // ──────────────────────────────────────────────
  // Utility: escape HTML
  // ──────────────────────────────────────────────

  function escapeHtml(raw) {
    if (typeof raw !== 'string') { return String(raw); }
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
