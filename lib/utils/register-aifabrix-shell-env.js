/**
 * Register AIFABRIX_HOME and AIFABRIX_WORK for new shells: Windows user env vars;
 * POSIX writes a sourced script next to config.yaml and ensures a profile snippet.
 *
 * @fileoverview OS/shell registration after dev set-home / dev set-work
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fsp = require('node:fs').promises;
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const execFileCb = require('child_process').execFile;
const execFile = promisify(execFileCb);

const { getConfigDirForPaths } = require('./paths');

const SHELL_ENV_BASENAME = 'aifabrix-shell-env.sh';
const BLOCK_BEGIN = '# BEGIN aifabrix-builder shell env';
const BLOCK_END = '# END aifabrix-builder shell env';

const PROFILE_BLOCK_RE = /\n?# BEGIN aifabrix-builder shell env\n[\s\S]*?\n# END aifabrix-builder shell env\n?/;

/**
 * Single-quote a path for POSIX export lines.
 * @param {string} p - Path
 * @returns {string} Quoted for sh
 */
function shSingleQuoted(p) {
  const esc = String.fromCharCode(39, 92, 39, 39);
  return `'${String(p).replace(/'/g, esc)}'`;
}

/**
 * Build body for aifabrix-shell-env.sh (exports only; no secrets).
 * @param {string|null} homeAbs - Resolved home or null
 * @param {string|null} workAbs - Resolved work or null
 * @returns {string} File content
 */
function buildPosixShellEnvBody(homeAbs, workAbs) {
  const lines = ['# Managed by aifabrix dev set-home / set-work. Do not edit.'];
  if (homeAbs) {
    lines.push(`export AIFABRIX_HOME=${shSingleQuoted(homeAbs)}`);
  }
  if (workAbs) {
    lines.push(`export AIFABRIX_WORK=${shSingleQuoted(workAbs)}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Profile snippet that sources the shell env file.
 * @param {string} envFileAbs - Absolute path to aifabrix-shell-env.sh
 * @returns {string} Block including markers
 */
function buildProfileBlock(envFileAbs) {
  const q = shSingleQuoted(envFileAbs);
  return `${BLOCK_BEGIN}
[ -f ${q} ] && . ${q}
${BLOCK_END}
`;
}

/**
 * Resolve YAML path string to absolute or null.
 * @param {*} raw - Config value
 * @returns {string|null}
 */
function absFromConfigRaw(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  return path.resolve(t);
}

/**
 * PowerShell to set or remove a user-scoped environment variable.
 * @param {string} name - Var name (caller must pass safe identifiers only)
 * @param {string|null} value - Absolute path or null to remove
 * @returns {string} PowerShell -Command argument body
 */
function psSetUserEnvStatement(name, value) {
  if (value === null || value === undefined || value === '') {
    return `[System.Environment]::SetEnvironmentVariable('${name}', $null, 'User')`;
  }
  const escaped = String(value).replace(/'/g, '\'\'');
  return `[System.Environment]::SetEnvironmentVariable('${name}', '${escaped}', 'User')`;
}

/**
 * Default rc file to patch (zsh vs bash).
 * @param {string} homedir - User home
 * @returns {string} Absolute profile path
 */
function defaultProfilePath(homedir) {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) {
    return path.join(homedir, '.zshrc');
  }
  return path.join(homedir, '.bashrc');
}

/**
 * Ensure ~/.zshrc or ~/.bashrc contains a single marked block sourcing envFileAbs.
 * @param {string} envFileAbs - Shell env file
 * @param {object} [overrides] - Test hooks
 * @param {string} [overrides.profilePath] - Profile file to edit
 * @param {string} [overrides.homedir] - Home directory
 * @returns {Promise<void>}
 */
async function ensureProfileShellBlock(envFileAbs, overrides = {}) {
  const homedir = overrides.homedir ?? os.homedir();
  const profilePath = overrides.profilePath ?? defaultProfilePath(homedir);
  const snippet = buildProfileBlock(envFileAbs);
  let existing = '';
  try {
    existing = await fsp.readFile(profilePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  if (PROFILE_BLOCK_RE.test(existing)) {
    const next = existing.replace(PROFILE_BLOCK_RE, `\n${snippet.trimEnd()}\n`);
    if (next !== existing) {
      await fsp.writeFile(profilePath, next, 'utf8');
    }
    return;
  }
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  await fsp.writeFile(profilePath, `${existing}${sep}${snippet}`, 'utf8');
}

/**
 * Apply Windows user env for both vars from current config (independent clear per key).
 * @param {string|null} homeAbs
 * @param {string|null} workAbs
 * @param {Function} [execFileImpl] - execFile (for tests)
 * @returns {Promise<void>}
 */
async function applyWindowsUserEnv(homeAbs, workAbs, execFileImpl = execFile) {
  const script = `${psSetUserEnvStatement('AIFABRIX_HOME', homeAbs)}; ${psSetUserEnvStatement(
    'AIFABRIX_WORK',
    workAbs
  )}`;
  await execFileImpl(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { windowsHide: true }
  );
}

/**
 * Write POSIX shell env file and ensure profile sources it.
 * @param {string|null} homeAbs
 * @param {string|null} workAbs
 * @param {object} overrides - Test hooks (same as ensureProfileShellBlock + getConfigDirForPaths)
 * @returns {Promise<void>}
 */
async function applyPosixShellEnv(homeAbs, workAbs, overrides = {}) {
  const configDir = overrides.getConfigDirForPaths ? overrides.getConfigDirForPaths() : getConfigDirForPaths();
  const envFile = path.join(configDir, SHELL_ENV_BASENAME);
  await fsp.mkdir(configDir, { recursive: true });
  const body = buildPosixShellEnvBody(homeAbs, workAbs);
  await fsp.writeFile(envFile, body, { mode: 0o600, flag: 'w' });
  await ensureProfileShellBlock(path.resolve(envFile), overrides);
}

/**
 * Sync user/shell environment from saved config.yaml (after set-home or set-work).
 *
 * @async
 * @param {function(): Promise<object>} getConfigFn - Same as config.getConfig
 * @param {object} [overrides] - Optional { platform, execFile, getConfigDirForPaths, profilePath, homedir }
 * @returns {Promise<void>}
 */
async function registerAifabrixShellEnvFromConfig(getConfigFn, overrides = {}) {
  const platform = overrides.platform ?? process.platform;
  const config = await getConfigFn();
  const homeAbs = absFromConfigRaw(config['aifabrix-home']);
  const workAbs = absFromConfigRaw(config['aifabrix-work']);

  if (platform === 'win32') {
    await applyWindowsUserEnv(homeAbs, workAbs, overrides.execFile || execFile);
    return;
  }

  await applyPosixShellEnv(homeAbs, workAbs, overrides);
}

module.exports = {
  registerAifabrixShellEnvFromConfig,
  buildPosixShellEnvBody,
  buildProfileBlock,
  shSingleQuoted,
  psSetUserEnvStatement,
  ensureProfileShellBlock,
  SHELL_ENV_BASENAME,
  BLOCK_BEGIN,
  BLOCK_END
};
