/**
 * Manual test setup: validate auth before any test runs.
 * Runs "aifabrix auth status --validate"; on failure, outputs the same error and exits.
 *
 * @fileoverview Auth validation for manual tests (real API calls)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const binPath = path.join(projectRoot, 'bin', 'aifabrix.js');

const result = spawnSync(
  process.execPath,
  [binPath, 'auth', 'status', '--validate'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe']
  }
);

if (result.status !== 0) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.status !== undefined && result.status !== null ? result.status : 1);
}
