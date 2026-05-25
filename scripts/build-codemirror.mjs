/**
 * build-codemirror.mjs — Bundles CodeMirror 6 into a single IIFE for webview use.
 *
 * Output: media/codemirror-bundle.js
 * Exposes: CodeMirrorBundle global with { EditorView, basicSetup, javascript, vscodeDark }
 *
 * Run: node scripts/build-codemirror.mjs
 */

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['scripts/codemirror-entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'CodeMirrorBundle',
  outfile: 'media/codemirror-bundle.js',
  minify: false,
  platform: 'browser',
  external: [],
});

console.log('✓ CodeMirror bundle written to media/codemirror-bundle.js');
