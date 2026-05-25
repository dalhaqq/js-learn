import * as assert from 'assert';
import * as vscode from 'vscode';

// ──────────────────────────────────────────────
// Helper: find and activate our extension
// ──────────────────────────────────────────────

async function findAndActivateExtension(): Promise<vscode.Extension<unknown>> {
	const allExtensions = vscode.extensions.all;
	const ourExtension = allExtensions.find(
		(ext) =>
			ext.id.endsWith('js-learn') ||
			ext.packageJSON.name === 'js-learn',
	);

	if (!ourExtension) {
		throw new Error('Extension js-learn not found in loaded extensions');
	}

	if (!ourExtension.isActive) {
		await ourExtension.activate();
	}

	assert.ok(ourExtension.isActive, 'Extension did not activate');
	return ourExtension;
}

// ──────────────────────────────────────────────
// Integration Test Suite
// ──────────────────────────────────────────────

suite('Extension Integration Test Suite', () => {
	suiteSetup(async function (): Promise<void> {
		// Integration tests need more time for extension host startup.
		this.timeout(30000);
	});

	// ── Test 1 ──────────────────────────────────

	test('Extension activates → TreeView and commands are registered', async () => {
		await findAndActivateExtension();

		// Verify commands are registered
		const allCommands: string[] = await vscode.commands.getCommands(true);

		assert.ok(
			allCommands.includes('jslearn.openExercise'),
			'jslearn.openExercise command should be registered',
		);
		assert.ok(
			allCommands.includes('jslearn.runCode'),
			'jslearn.runCode command should be registered',
		);
		assert.ok(
			allCommands.includes('jslearn.skipExercise'),
			'jslearn.skipExercise command should be registered',
		);
		assert.ok(
			allCommands.includes('jslearn.requestHint'),
			'jslearn.requestHint command should be registered',
		);
	});

	// ── Test 2 ──────────────────────────────────

	test('jslearn.runCode returns pass for correct solution on output-mode exercise', async () => {
		await findAndActivateExtension();

		// basics-variables-001 is an output-mode exercise
		const correctCode = `let nama = 'Budi';
const umur = 25;
console.log('Halo, nama saya ' + nama + ', umur saya ' + umur + ' tahun');`;

		const result = (await vscode.commands.executeCommand(
			'jslearn.runCode',
			{
				exerciseId: 'basics-variables-001',
				code: correctCode,
			},
		)) as { passed: boolean; message: string; details?: string } | undefined;

		assert.ok(result, 'runCode should return a result');
		assert.strictEqual(
			result!.passed,
			true,
			'Correct solution should pass: ' + JSON.stringify(result),
		);
	});

	// ── Test 3 ──────────────────────────────────

	test('Full workflow: run correct code → passes → run incorrect code → fails → skip → solution returned', async () => {
		await findAndActivateExtension();

		const exerciseId = 'basics-variables-001';

		// Step A: run incorrect code → should fail
		const incorrectCode = `let nama = 'Salah';
console.log('Halo nama saya ' + nama);`;

		const failResult = (await vscode.commands.executeCommand(
			'jslearn.runCode',
			{
				exerciseId,
				code: incorrectCode,
			},
		)) as { passed: boolean; message: string; details?: string } | undefined;

		assert.ok(failResult, 'runCode should return a result for incorrect code');
		assert.strictEqual(
			failResult!.passed,
			false,
			'Incorrect solution should fail',
		);

		// Step B: run correct code → should pass
		const correctCode = `let nama = 'Budi';
const umur = 25;
console.log('Halo, nama saya ' + nama + ', umur saya ' + umur + ' tahun');`;

		const passResult = (await vscode.commands.executeCommand(
			'jslearn.runCode',
			{
				exerciseId,
				code: correctCode,
			},
		)) as { passed: boolean; message: string; details?: string } | undefined;

		assert.ok(passResult, 'runCode should return a result for correct code');
		assert.strictEqual(
			passResult!.passed,
			true,
			'Correct solution should pass',
		);
		assert.ok(
			passResult!.message.includes('Berhasil'),
			'Pass message should be in Indonesian',
		);

		// Step C: skip the exercise
		const skipResult = (await vscode.commands.executeCommand(
			'jslearn.skipExercise',
			{ exerciseId },
		)) as { success: boolean; solution: string } | undefined;

		assert.ok(skipResult, 'skipExercise should return a result');
		assert.strictEqual(skipResult!.success, true);
		assert.ok(
			typeof skipResult!.solution === 'string' &&
				skipResult!.solution.length > 0,
			'Skipped exercise should return solution code',
		);
	});

	// ── Test 4 (bonus) ──────────────────────────

	test('jslearn.requestHint returns hints for a known exercise', async () => {
		await findAndActivateExtension();

		// Request the first hint
		const hint0 = (await vscode.commands.executeCommand(
			'jslearn.requestHint',
			{
				exerciseId: 'basics-variables-001',
				index: 0,
			},
		)) as { hint: string | undefined } | undefined;

		assert.ok(hint0, 'requestHint should return a result');
		assert.ok(
			typeof hint0!.hint === 'string' && hint0!.hint.length > 0,
			'First hint should be a non-empty string',
		);

		// Request a hint at an out-of-range index
		const hintOutOfRange = (await vscode.commands.executeCommand(
			'jslearn.requestHint',
			{
				exerciseId: 'basics-variables-001',
				index: 999,
			},
		)) as { hint: string | undefined } | undefined;

		assert.ok(hintOutOfRange, 'requestHint should return a result for out-of-range index');
		assert.strictEqual(
			hintOutOfRange!.hint,
			undefined,
			'Out-of-range hint index should return undefined',
		);
	});

	// ── Test 5 (bonus) ──────────────────────────

	test('jslearn.runCode returns error for nonexistent exercise', async () => {
		await findAndActivateExtension();

		const result = (await vscode.commands.executeCommand(
			'jslearn.runCode',
			{
				exerciseId: 'nonexistent-exercise-id',
				code: 'console.log("test");',
			},
		)) as { passed: boolean } | undefined;

		// Should not throw; return value is undefined because showErrorMessage was called
		assert.strictEqual(
			result,
			undefined,
			'Running code for nonexistent exercise should return undefined',
		);
	});
});
