/**
 * Runner to execute getResolveAppPath in a fresh process with real fs.
 * Used by paths-detect-app-type.test.js so tests pass when Jest's fs is mocked.
 * Usage: node run-get-resolve-app-path.js <projectRoot> <appName>
 */
const path = require('path');
const projectRoot = process.argv[2];
const appName = process.argv[3];
if (!projectRoot || !appName) {
  process.stderr.write('Usage: node run-get-resolve-app-path.js <projectRoot> <appName>\n');
  process.exit(1);
}
process.chdir(projectRoot);
global.PROJECT_ROOT = projectRoot;
const paths = require('../../../lib/utils/paths');
paths.clearProjectRootCache();
paths.getResolveAppPath(appName)
  .then((r) => {
    process.stdout.write(JSON.stringify(r));
  })
  .catch((e) => {
    process.stderr.write(e.message || String(e));
    process.exit(1);
  });
