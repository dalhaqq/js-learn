/**
 * @file Packaging tests — verifies .vsix file integrity, contents, and
 * that no `.ts` source files leak into the packaged extension.
 *
 * Pure Node.js — no VS Code dependency.
 * Run AFTER `npm run package` produces a `.vsix` file.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Find the first `.vsix` file in the project root (sorted by mtime, newest first). */
function findVsix(): string {
  const cwd = process.cwd();
  const files = fs
    .readdirSync(cwd)
    .filter((f) => /^js-learn-[\d.]+\.vsix$/.test(f))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(cwd, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  assert.ok(files.length > 0, 'No .vsix file found — run `npm run package` first');
  return files[0].name;
}

/**
 * List entries inside a .vsix (ZIP) file by reading the central directory.
 * Pure Node.js — no external dependencies.
 */
function listVsixEntries(zipPath: string): string[] {
  const stat = fs.statSync(zipPath);
  const fd = fs.openSync(zipPath, 'r');

  // Read tail of file to find End-of-Central-Directory record
  const maxComment = 65535;
  const tailSize = Math.min(22 + maxComment, stat.size);
  const tail = Buffer.alloc(tailSize);
  fs.readSync(fd, tail, 0, tailSize, stat.size - tailSize);
  fs.closeSync(fd);

  // Locate EOCD signature PK\x05\x06
  let eocdPos = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) throw new Error('Could not find EOCD record in ZIP');

  const cdOffset = tail.readUInt32LE(eocdPos + 16);
  const cdEntries = tail.readUInt16LE(eocdPos + 8);

  // Read and parse central directory
  const cdSize = stat.size - cdOffset;
  const cdBuf = Buffer.alloc(cdSize);
  const fd2 = fs.openSync(zipPath, 'r');
  fs.readSync(fd2, cdBuf, 0, cdSize, cdOffset);
  fs.closeSync(fd2);

  const entries: string[] = [];
  let pos = 0;
  for (let i = 0; i < cdEntries; i++) {
    if (cdBuf.readUInt32LE(pos) !== 0x02014b50) break;
    const nameLen = cdBuf.readUInt16LE(pos + 28);
    const extraLen = cdBuf.readUInt16LE(pos + 30);
    const commentLen = cdBuf.readUInt16LE(pos + 32);
    const name = cdBuf.toString('utf8', pos + 46, pos + 46 + nameLen);
    if (name) entries.push(name);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Normalize a vsix entry path to a logical path relative to `extension/`.
 * VSCE wraps all files under an `extension/` directory inside the ZIP — strip it.
 */
function norm(p: string): string {
  return p.replace(/^extension\//, '');
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Packaging', function () {
  this.slow(30_000);
  this.timeout(60_000);

  let vsixFile: string;
  let vsixPath: string;
  let entries: string[];

  before(() => {
    vsixFile = findVsix();
    vsixPath = path.resolve(vsixFile);
    entries = listVsixEntries(vsixPath);
  });

  // ── Test 1: .vsix file generated with correct size ──────────────

  it('should generate a .vsix file larger than 10 KB', () => {
    const stat = fs.statSync(vsixPath);
    assert.ok(
      stat.size > 10_240,
      `.vsix too small: ${stat.size} bytes (expected > 10240)`,
    );
  });

  // ── Test 2: .vsix is a valid ZIP file ────────────────────────────

  it('should be a valid ZIP archive (PK\\x03\\x04 header)', () => {
    const fd = fs.openSync(vsixPath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    assert.strictEqual(
      buf.toString(),
      'PK\x03\x04',
      'File does not start with ZIP magic bytes',
    );
  });

  // ── Test 3: no .ts source files in the vsix ──────────────────────

  it('should not contain any .ts source files', () => {
    const tsFiles = entries.filter(
      (e) => e.endsWith('.ts') && !e.endsWith('.d.ts'),
    );
    assert.strictEqual(
      tsFiles.length,
      0,
      `Found ${tsFiles.length} .ts source file(s) in .vsix: ${tsFiles.join(', ')}`,
    );
  });

  // ── Test 4: key files present ────────────────────────────────────

  it('should include out/extension.js', () => {
    assert.ok(
      entries.some((e) => norm(e) === 'out/extension.js'),
      'Missing out/extension.js',
    );
  });

  it('should include media/ assets (CSS + JS)', () => {
    const mediaFiles = entries.filter((e) => norm(e).startsWith('media/'));
    assert.ok(mediaFiles.length >= 4, `Expected ≥4 media/ files, got ${mediaFiles.length}`);
    assert.ok(mediaFiles.some((e) => norm(e).endsWith('.css')), 'Missing CSS in media/');
    assert.ok(mediaFiles.some((e) => norm(e).endsWith('.js')), 'Missing JS in media/');
  });

  it('should include exercise JSON files via out/exercises/', () => {
    const rel = entries.map(norm);
    const exerciseJsons = rel.filter(
      (e) => e.startsWith('out/exercises/') && e.endsWith('.json'),
    );
    assert.ok(
      exerciseJsons.length >= 3,
      `Expected ≥3 exercise JSONs, got ${exerciseJsons.length}`,
    );
  });

  it('should include out/errors/ErrorHandler.js', () => {
    assert.ok(
      entries.some((e) => norm(e) === 'out/errors/ErrorHandler.js'),
      'Missing ErrorHandler.js',
    );
  });

  it('should include out/i18n/messages.js', () => {
    assert.ok(
      entries.some((e) => norm(e) === 'out/i18n/messages.js'),
      'Missing i18n/messages.js',
    );
  });
});
