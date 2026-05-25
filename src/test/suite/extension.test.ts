import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		// Find our extension by checking all loaded extensions
		// Extension ID format: publisher.name — publisher may be empty string
		const allExtensions = vscode.extensions.all;
		assert.ok(allExtensions.length > 0, 'No extensions loaded in test environment');

		const ourExtension = allExtensions.find(
			(ext) =>
				ext.id.endsWith('js-learn') ||
				ext.packageJSON.name === 'js-learn' ||
				ext.packageJSON.displayName === 'JS Learn'
		);

		assert.ok(ourExtension, 'Extension js-learn not found in loaded extensions');
	});

	test('Extension should activate without error', async () => {
		const allExtensions = vscode.extensions.all;
		const ourExtension = allExtensions.find(
			(ext) =>
				ext.id.endsWith('js-learn') ||
				ext.packageJSON.name === 'js-learn'
		);

		assert.ok(ourExtension, 'Extension js-learn not found');

		if (!ourExtension.isActive) {
			try {
				await ourExtension.activate();
			} catch (err) {
				assert.fail(`Extension activation threw: ${err}`);
			}
		}

		assert.ok(ourExtension.isActive, 'Extension did not activate');
	});
});
