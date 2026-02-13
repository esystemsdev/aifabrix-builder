/**
 * Runner to execute detectAppType in a fresh process with real fs.
 * Used by paths-detect-app-type.test.js so tests pass when Jest's fs is mocked.
 * Usage: node run-detect-app-type.js <projectRoot> <appName> [optionsJson]
 */
const path = require('path');
const projectRoot = process.argv[2];
const appName = process.argv[3];
const optionsJson = process.argv[4] || '{}';
if (!projectRoot || !appName) {
  process.stderr.write('Usage: node run-detect-app-type.js <projectRoot> <appName> [optionsJson]\n');
  process.exit(1);
}
process.chdir(projectRoot);
global.PROJECT_ROOT = projectRoot;
const paths = require('../../../lib/utils/paths');
paths.clearProjectRootCache();
const options = JSON.parse(optionsJson);
paths.detectAppType(appName, options)
  .then((r) => {
    process.stdout.write(JSON.stringify(r));
  })
  .catch((e) => {
    process.stderr.write(e.message || String(e));
    process.exit(1);
  });
