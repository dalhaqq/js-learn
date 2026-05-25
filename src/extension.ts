import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { I18N } from './i18n/messages';
import { FileExerciseProvider } from './providers/FileExerciseProvider';
import { LessonTreeProvider } from './providers/LessonTreeProvider';
import { ProgressStore } from './storage/ProgressStore';
import { CodeRunner } from './terminal/CodeRunner';
import { OutputVerifier } from './verifiers/OutputVerifier';
import { TestVerifier } from './verifiers/TestVerifier';
import { ExercisePanel } from './webview/ExercisePanel';
import { VerificationResult, Exercise } from './types';

export function activate(context: vscode.ExtensionContext): void {
	// ──────────────────────────────────────────────
	// 1. Node.js version check
	// ──────────────────────────────────────────────
	const nodeVersion: string = process.version;
	const majorMatch: RegExpMatchArray | null = nodeVersion.slice(1).match(/^(\d+)/);
	const majorVersion: number = majorMatch ? parseInt(majorMatch[1], 10) : 0;
	if (majorVersion < 18) {
		vscode.window.showWarningMessage(
			I18N.errors.nodeVersion(nodeVersion, '18'),
		);
	}

	// ──────────────────────────────────────────────
	// 2. Instantiate all providers
	// ──────────────────────────────────────────────
	const exercisesDir: string = path.join(context.extensionPath, 'out', 'exercises');
	const exerciseProvider: FileExerciseProvider = new FileExerciseProvider(exercisesDir);
	const progressStore: ProgressStore = new ProgressStore(context);
	const lessonTreeProvider: LessonTreeProvider = new LessonTreeProvider(
		exerciseProvider,
		progressStore,
	);
	const codeRunner: CodeRunner = new CodeRunner();
	const outputVerifier: OutputVerifier = new OutputVerifier();
	const testVerifier: TestVerifier = new TestVerifier(codeRunner);

	// ──────────────────────────────────────────────
	// 3. Register TreeView
	// ──────────────────────────────────────────────
	const treeView: vscode.TreeView<unknown> = vscode.window.createTreeView('jslearn.lessons', {
		treeDataProvider: lessonTreeProvider,
	});
	context.subscriptions.push(treeView);

	// ──────────────────────────────────────────────
	// 4. Shared verifier dispatch helper
	// ──────────────────────────────────────────────
	async function runVerification(
		exercise: Exercise,
		code: string,
	): Promise<VerificationResult> {
		const mode = exercise.verification.mode;

		if (mode === 'output') {
			const runResult = await codeRunner.run(code);
			const result = outputVerifier.verify(exercise, runResult.output);
			result.output = runResult.output;
			return result;
		}

		if (mode === 'test') {
			return testVerifier.verify(exercise, code);
		}

		// mode === 'both' — output + test must both pass
		const [runResult, testResult] = await Promise.all([
			codeRunner.run(code),
			testVerifier.verify(exercise, code),
		]);
		const outputResult: VerificationResult = outputVerifier.verify(
			exercise,
			runResult.output,
		);

		if (outputResult.passed && testResult.passed) {
			return {
				passed: true,
				message: I18N.verification.passAll,
				output: runResult.output,
			};
		}

		return {
			passed: false,
			message: I18N.verification.fail,
			details: !outputResult.passed ? outputResult.details : testResult.details,
			output: runResult.output,
		};
	}

	// ──────────────────────────────────────────────
	// 5. Register commands
	// ──────────────────────────────────────────────

	// jslearn.openExercise — triggered by TreeView click
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'jslearn.openExercise',
			async (exerciseId: string) => {
				const exercise: Exercise | undefined =
					await exerciseProvider.getExercise(exerciseId);
				if (!exercise) {
					vscode.window.showErrorMessage(
						I18N.errors.exerciseNotFound(exerciseId),
					);
					return;
				}

				const progress = progressStore.getProgress(exerciseId);

				const panel: ExercisePanel = ExercisePanel.createOrShow(
					context.extensionUri,
					exercise,
					progress,
					// onRun — executes when learner clicks "Jalankan Kode" in webview
					async (code: string) => {
						const currentPanel = ExercisePanel.currentPanel;
						if (!currentPanel) {
							return;
						}

						try {
							// Reconstruct fill-blank code: replace ___BLANK___ with user values
							if (exercise.type === 'fill-blank') {
								try {
									const blankValues: string[] = JSON.parse(code);
									let filledCode = exercise.starterCode;
									for (const value of blankValues) {
										filledCode = filledCode.replace('___BLANK___', value);
									}
									code = filledCode;
								} catch {
									// If JSON parse fails, pass code as-is (e.g., raw text from manual call)
								}
							}
							const result: VerificationResult = await runVerification(
								exercise,
								code,
							);
							currentPanel.showResult(result);

							if (result.passed) {
								await progressStore.markCompleted(exerciseId);
								lessonTreeProvider.refresh();
							}
						} catch (err: unknown) {
							const message: string =
								err instanceof Error ? err.message : String(err);
							currentPanel.showResult({
								passed: false,
								message: I18N.verification.runtimeError,
								details: message,
							});
						}
					},
					// onSkip — executes when learner clicks "Lewati" in webview
					async () => {
						await progressStore.markSkipped(exerciseId);
						const currentPanel = ExercisePanel.currentPanel;
						if (currentPanel) {
							currentPanel.showSolution(exercise.solution);
						}
						lessonTreeProvider.refresh();
					},
				);

				// Persist exerciseId in webview state for deserialization
				// after VS Code restart.
				panel.setState({ exerciseId: exercise.id });
			},
		),
	);

	// jslearn.runCode — programmatic code execution (returns VerificationResult)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'jslearn.runCode',
			async (args: { exerciseId: string; code: string }) => {
				const exercise: Exercise | undefined =
					await exerciseProvider.getExercise(args.exerciseId);
				if (!exercise) {
					vscode.window.showErrorMessage(I18N.setup.exerciseNotFound);
					return;
				}

				let code = args.code;
				// Reconstruct fill-blank code: replace ___BLANK___ with user values
				if (exercise.type === 'fill-blank') {
					try {
						const blankValues: string[] = JSON.parse(code);
						let filledCode = exercise.starterCode;
						for (const value of blankValues) {
							filledCode = filledCode.replace('___BLANK___', value);
						}
						code = filledCode;
					} catch {
						// If JSON parse fails, pass code as-is
					}
				}
				return runVerification(exercise, code);
			},
		),
	);

	// jslearn.skipExercise — programmatic skip (returns solution)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'jslearn.skipExercise',
			async (args: { exerciseId: string }) => {
				const exercise: Exercise | undefined =
					await exerciseProvider.getExercise(args.exerciseId);
				if (!exercise) {
					vscode.window.showErrorMessage(I18N.setup.exerciseNotFound);
					return;
				}

				await progressStore.markSkipped(args.exerciseId);
				lessonTreeProvider.refresh();

				return { success: true, solution: exercise.solution };
			},
		),
	);

	// jslearn.requestHint — retrieve a specific hint by index
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'jslearn.requestHint',
			async (args: { exerciseId: string; index: number }) => {
				const exercise: Exercise | undefined =
					await exerciseProvider.getExercise(args.exerciseId);
				if (!exercise) {
					vscode.window.showErrorMessage(I18N.setup.exerciseNotFound);
					return;
				}

				const index: number = args.index;
				const hint: string | undefined =
					index >= 0 && index < exercise.hints.length
						? exercise.hints[index]
						: undefined;

				return { hint };
			},
		),
	);

	// ──────────────────────────────────────────────
	// 6. Register webview panel serializer
	//    Restores exercise panel after VS Code restart.
	// ──────────────────────────────────────────────
	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer('jslearn.exercise', {
			async deserializeWebviewPanel(
				webviewPanel: vscode.WebviewPanel,
				state: unknown,
			): Promise<void> {
				const savedState = state as
					| { exerciseId?: string }
					| undefined;
				const exerciseId: string | undefined = savedState?.exerciseId;
				if (!exerciseId) {
					return;
				}

				const exercise: Exercise | undefined =
					await exerciseProvider.getExercise(exerciseId);
				if (!exercise) {
					return;
				}

				ExercisePanel.revive(
					webviewPanel,
					context.extensionUri,
					exercise,
					async (code: string) => {
						const panel = ExercisePanel.currentPanel;
						if (!panel) {
							return;
						}
						try {
							const result: VerificationResult =
								await runVerification(exercise, code);
							panel.showResult(result);

							if (result.passed) {
								await progressStore.markCompleted(exerciseId);
								lessonTreeProvider.refresh();
							}
						} catch (err: unknown) {
							const message: string =
								err instanceof Error
									? err.message
									: String(err);
							panel.showResult({
								passed: false,
								message: I18N.verification.runtimeError,
								details: message,
							});
						}
					},
					async () => {
						await progressStore.markSkipped(exerciseId);
						const panel = ExercisePanel.currentPanel;
						if (panel) {
							panel.showSolution(exercise.solution);
						}
						lessonTreeProvider.refresh();
					},
				);
			},
		}),
	);
}

export function deactivate(): void {
	// Clean up leftover temp files from CodeRunner executions.
	const tempDir: string = path.join(os.tmpdir(), 'jslearn');
	try {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	} catch {
		// Best-effort cleanup — the OS will eventually reclaim temp files.
	}
}
