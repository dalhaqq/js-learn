/**
 * codemirror-entry.js — Entry point for the CodeMirror bundle.
 *
 * Re-exports the specific CodeMirror 6 modules that the webview panels need.
 * esbuild bundles this into a single IIFE with globalName 'CodeMirrorBundle'.
 */

export { EditorView } from '@codemirror/view';
export { basicSetup } from 'codemirror';
export { javascript } from '@codemirror/lang-javascript';
export { vscodeDark } from '@uiw/codemirror-theme-vscode';
