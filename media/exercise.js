/**
 * exercise.js — Webview-side script for JS Learn exercise panel.
 *
 * Runs inside the webview sandbox. Communicates with the extension host
 * via the VS Code webview API (acquireVsCodeApi).
 *
 * Features:
 *  - CodeMirror 6 editor with JavaScript syntax highlighting
 *  - State persistence across tab switches (vscode.getState/setState)
 *  - Run / Skip button wiring (postMessage to extension)
 *  - Result display (pass/fail with details)
 *  - Solution reveal (via CodeMirror dispatch)
 *  - Fill-blank input collection (gathers blank values for run)
 *  - Multiple-choice selection collection (gathers selected value for run)
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
  // State persistence: blank inputs (fill-blank)
  // ──────────────────────────────────────────────

  var blankInputs = document.querySelectorAll('.blank-input');
  if (previousState.blanks) {
    for (var i = 0; i < blankInputs.length; i++) {
      if (previousState.blanks[i] !== undefined) {
        blankInputs[i].value = previousState.blanks[i];
      }
    }
  }
  for (var j = 0; j < blankInputs.length; j++) {
    (function (index) {
      blankInputs[index].addEventListener('input', function () {
        if (!previousState.blanks) {
          previousState.blanks = [];
        }
        previousState.blanks[index] = blankInputs[index].value;
        vscode.setState(previousState);
      });
    })(j);
  }

  // ──────────────────────────────────────────────
  // State persistence: radio (multiple-choice)
  // ──────────────────────────────────────────────

  var radios = document.querySelectorAll('input[name="mc-answer"]');
  if (previousState.choice && radios.length > 0) {
    for (var k = 0; k < radios.length; k++) {
      if (radios[k].value === previousState.choice) {
        radios[k].checked = true;
        break;
      }
    }
  }
  for (var m = 0; m < radios.length; m++) {
    radios[m].addEventListener('change', function () {
      previousState.choice = this.value;
      vscode.setState(previousState);
    });
  }

  // ──────────────────────────────────────────────
  // Buttons: run and skip
  // ──────────────────────────────────────────────

  var btnRun = document.getElementById('btn-run');
  if (btnRun) {
    btnRun.addEventListener('click', function () {
      var code = '';
      var bodyEl = document.body;
      var exerciseType = bodyEl.dataset.exerciseType || 'write';

      if (exerciseType === 'fill-blank') {
        // Collect blank input values
        var blanks = document.querySelectorAll('.blank-input');
        var blankValues = [];
        for (var n = 0; n < blanks.length; n++) {
          blankValues.push(blanks[n].value || '');
        }
        code = JSON.stringify(blankValues);
      } else if (exerciseType === 'multiple-choice') {
        var selected = document.querySelector('input[name="mc-answer"]:checked');
        code = selected ? selected.value : '';
      } else {
        // Get code from CodeMirror editor
        code = editorView ? editorView.state.doc.toString() : '';
      }

      vscode.postMessage({ command: 'run', code: code });
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
    var outputContent = document.getElementById('output-content');

    switch (msg.command) {
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
