/**
 * Resolve .env in memory and write only to envOutputPath or temp (no builder/ or integration/).
 *
 * @fileoverview Single .env write for run flow (plan 66)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Resolve .env in memory and write only to envOutputPath or a temp file.
 * No write to builder/ or integration/. For run flow: use this instead of generateEnvFile.
 *
 * @async
 * @function resolveAndWriteEnvFile
 * @param {string} appName - Application name
 * @param {Object} options - Options
 * @param {string|null} [options.envOutputPath] - Absolute path to write .env (when set)
 * @param {string} [options.environment='docker'] - Environment context ('local' or 'docker')
 * @param {string|null} [options.secretsPath] - Path to secrets file (optional)
 * @param {boolean} [options.force=false] - Generate missing secret keys
 * @returns {Promise<string>} Path where .env was written (envOutputPath or temp file)
 * @throws {Error} If generation fails
 */
async function resolveAndWriteEnvFile(appName, options = {}) {
  const secrets = require('./secrets');
  const envOutputPath = options.envOutputPath || null;
  const environment = options.environment || 'docker';
  const secretsPath = options.secretsPath || null;
  const force = options.force === true;

  const resolved = await secrets.generateEnvContent(appName, secretsPath, environment, force);

  if (envOutputPath && typeof envOutputPath === 'string') {
    const dir = path.dirname(envOutputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(envOutputPath, resolved, { mode: 0o600 });
    return envOutputPath;
  }

  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `aifabrix-${appName}-${Date.now()}.env`);
  fs.writeFileSync(tmpPath, resolved, { mode: 0o600 });
  return tmpPath;
}

module.exports = { resolveAndWriteEnvFile };
