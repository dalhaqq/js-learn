import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 30000
	});

	const testsRoot = path.resolve(__dirname, '.');

	return new Promise((resolve, reject) => {
		// Read all test files from the suite directory
		fs.readdirSync(testsRoot)
			.filter((file: string) => file.endsWith('.test.js'))
			.forEach((file: string) => {
				mocha.addFile(path.resolve(testsRoot, file));
			});

		try {
			// Run the mocha test
			mocha.run((failures: number) => {
				if (failures > 0) {
					reject(new Error(`${failures} tests failed.`));
				} else {
					resolve();
				}
			});
		} catch (err) {
			reject(err);
		}
	});
}
