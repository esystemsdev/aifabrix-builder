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
 * Check if env content has a non-empty value for a given key (KEY=value line).
 * Returns false when value is empty or an unresolved kv:// reference.
 * @param {string} content - .env-style content
 * @param {string} key - Variable name (e.g. NPM_TOKEN)
 * @returns {boolean} True if key exists with a real value (non-empty, not kv://)
 */
function envContentHasKey(content, key) {
  if (!content || typeof content !== 'string') return false;
  const re = new RegExp(`^${key}=(.+)$`, 'm');
  const m = content.match(re);
  if (!m || !m[1]) return false;
  const val = String(m[1]).trim();
  return val.length > 0 && !val.startsWith('kv://');
}

/**
 * Get secret value trying common key variants (e.g. npm_token, NPM_TOKEN, npm-token).
 * @param {Object} secrets - Loaded secrets object
 * @param {string} preferred - Preferred key (e.g. 'NPM_TOKEN')
 * @param {string} alternate - Alternate key (e.g. 'npm_token')
 * @returns {string|null} Value or null
 */
function getSecretForEnvVar(secrets, preferred, alternate) {
  if (!secrets || typeof secrets !== 'object') return null;
  const keys = [preferred, alternate];
  if (alternate.includes('_')) keys.push(alternate.replace('_', '-'));
  for (const k of keys) {
    const v = secrets[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/**
 * Append KEY=value as its own line (avoids joining with previous line when content ended with newline).
 * @param {string} content
 * @param {string} key
 * @param {string} value
 * @returns {string}
 */
function appendEnvLine(content, key, value) {
  const line = `${key}=${value}`;
  if (!content || content.length === 0) return `${line}\n`;
  return `${content.replace(/\s+$/, '')}\n${line}\n`;
}

/**
 * Non-empty process.env for registry tokens when template has no kv://BASH_* line (inject fallback).
 * @param {string} name
 * @returns {string|null}
 */
function getProcessEnvToken(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return null;
  const t = String(raw).trim();
  return t.length > 0 ? t : null;
}

/**
 * Inject NPM_TOKEN and PYPI_TOKEN from loaded secrets, then from process.env when still missing.
 * kv://BASH_* refs are resolved in secrets-helpers (process.env suffix after BASH_) before this runs.
 * @param {string} content - .env-style content
 * @param {string|null} secretsPath - Path to secrets file
 * @param {string} appName - Application name
 * @returns {Promise<string>} Content with tokens injected when possible
 */
async function injectRegistryTokens(content, secretsPath, appName) {
  const secrets = require('./secrets');
  try {
    const loadedSecrets = await secrets.loadSecrets(secretsPath, appName);
    let out = content || '';
    if (!envContentHasKey(out, 'NPM_TOKEN')) {
      let v = getSecretForEnvVar(loadedSecrets, 'NPM_TOKEN', 'npm_token');
      if (!v) v = getProcessEnvToken('NPM_TOKEN');
      if (v) out = appendEnvLine(out, 'NPM_TOKEN', v);
    }
    if (!envContentHasKey(out, 'PYPI_TOKEN')) {
      let v = getSecretForEnvVar(loadedSecrets, 'PYPI_TOKEN', 'pypi_token');
      if (!v) v = getProcessEnvToken('PYPI_TOKEN');
      if (v) out = appendEnvLine(out, 'PYPI_TOKEN', v);
    }
    return out;
  } catch {
    return content || '';
  }
}

/**
 * Parse .env-style content into a key-value map (excludes comments and empty lines).
 * @param {string} content - .env-style content
 * @returns {Object.<string, string>} Map of variable name to value
 */
function parseEnvContentToMap(content) {
  const map = {};
  if (!content || typeof content !== 'string') return map;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      map[key] = trimmed.substring(eq + 1);
    }
  }
  return map;
}

/**
 * Resolve .env in memory and write only to envOutputPath or temp (no builder/ or integration/).
 * Injects NPM_TOKEN and PYPI_TOKEN from secrets when missing, then from process.env, so shell/install/test/build can use exported tokens.
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

  let resolved = await secrets.generateEnvContent(appName, secretsPath, environment, force);
  resolved = await injectRegistryTokens(resolved, secretsPath, appName);

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

/**
 * Resolve app env (template + kv:// secrets) and return as key-value map.
 * Used by build to pass NPM_TOKEN/PYPI_TOKEN as Docker build-args.
 * Injects from secrets when missing, then from process.env if set (e.g. exported NPM_TOKEN in shell).
 *
 * @async
 * @function resolveAndGetEnvMap
 * @param {string} appName - Application name
 * @param {Object} [options] - Options (same as resolveAndWriteEnvFile)
 * @returns {Promise<Object.<string, string>>} Map of variable name to value
 */
async function resolveAndGetEnvMap(appName, options = {}) {
  const secrets = require('./secrets');
  const environment = options.environment || 'docker';
  const secretsPath = options.secretsPath || null;
  const force = options.force === true;
  let content = await secrets.generateEnvContent(appName, secretsPath, environment, force);
  content = await injectRegistryTokens(content, secretsPath, appName);
  return parseEnvContentToMap(content);
}

module.exports = { resolveAndWriteEnvFile, resolveAndGetEnvMap };
