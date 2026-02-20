/**
 * Mutagen sync – binary path and session helpers (plan 65: sync for dev).
 *
 * @fileoverview Mutagen binary resolution; session create/resume/terminate
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const { getAifabrixHome } = require('./paths');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Name of the Mutagen binary (platform-specific).
 * @returns {string} mutagen or mutagen.exe
 */
function getMutagenBinaryName() {
  return process.platform === 'win32' ? 'mutagen.exe' : 'mutagen';
}

/**
 * Preferred path for Mutagen binary (~/.aifabrix/bin/mutagen or mutagen.exe).
 * @returns {string} Absolute path
 */
function getMutagenBinPath() {
  const home = getAifabrixHome();
  return path.join(home, 'bin', getMutagenBinaryName());
}

/**
 * Resolve path to Mutagen binary. Uses only ~/.aifabrix/bin/ (never system PATH).
 * @returns {Promise<string|null>} Path to binary or null if not installed
 */
async function getMutagenPath() {
  const preferred = getMutagenBinPath();
  return fs.existsSync(preferred) ? preferred : null;
}

/**
 * Ensure Mutagen is available: return path if already installed, otherwise download and install
 * to ~/.aifabrix/bin/ then return that path. Per remote-docker.md: CLI installs when missing.
 * @param {(msg: string) => void} [log] - Optional progress logger (e.g. logger.log)
 * @returns {Promise<string>} Path to Mutagen binary
 * @throws {Error} If install fails (unsupported platform, network, etc.)
 */
async function ensureMutagenPath(log) {
  const existing = await getMutagenPath();
  if (existing) return existing;
  const installMutagen = require('./mutagen-install').installMutagen;
  await installMutagen(log);
  const pathAfter = getMutagenBinPath();
  if (!fs.existsSync(pathAfter)) {
    throw new Error('Mutagen install did not create binary at ' + pathAfter);
  }
  return pathAfter;
}

/**
 * Session name for app: aifabrix-<dev-id>-<app-key>
 * @param {string} developerId - Developer ID
 * @param {string} appKey - App key (e.g. app name)
 * @returns {string}
 */
function getSessionName(developerId, appKey) {
  return `aifabrix-${developerId}-${appKey}`;
}

/**
 * Remote path for sync and Docker -v: user-mutagen-folder + '/' + relative path.
 * Relative path is remoteSyncPath (normalized) when set, else 'dev/' + appKey.
 * @param {string} userMutagenFolder - From config (no trailing slash)
 * @param {string} appKey - App key (used when relativePathOverride is unset)
 * @param {string} [relativePathOverride] - Optional; when non-empty, used as relative path under user-mutagen-folder (leading slashes stripped)
 * @returns {string}
 */
function getRemotePath(userMutagenFolder, appKey, relativePathOverride) {
  const base = (userMutagenFolder || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  const raw = typeof relativePathOverride === 'string' ? relativePathOverride.trim() : '';
  const relative = raw ? raw.replace(/^\/+/, '') : '';
  if (relative) return `${base}/${relative}`;
  return `${base}/dev/${appKey}`;
}

/**
 * SSH URL for Mutagen: sync-ssh-user@sync-ssh-host:remote_path
 * @param {string} syncSshUser - SSH user
 * @param {string} syncSshHost - SSH host
 * @param {string} remotePath - Remote path
 * @returns {string}
 */
function getSyncSshUrl(syncSshUser, syncSshHost, remotePath) {
  if (!syncSshUser || !syncSshHost || !remotePath) return '';
  return `${syncSshUser}@${syncSshHost}:${remotePath}`;
}

/**
 * List sync session names (one per line).
 * @param {string} mutagenPath - Path to mutagen binary
 * @returns {Promise<string[]>}
 */
async function listSyncSessionNames(mutagenPath) {
  const { stdout } = await execAsync(`"${mutagenPath}" sync list --template '{{.Name}}'`, {
    encoding: 'utf8',
    timeout: 5000
  });
  return (stdout || '').trim().split('\n').filter(Boolean);
}

/**
 * Ensure a sync session exists: create or resume. Idempotent.
 * @param {string} mutagenPath - Path to mutagen binary
 * @param {string} sessionName - Session name (e.g. aifabrix-01-myapp)
 * @param {string} localPath - Local app directory (absolute)
 * @param {string} sshUrl - Remote SSH URL (user@host:path)
 * @returns {Promise<void>}
 * @throws {Error} If create or resume fails
 */
async function ensureSyncSession(mutagenPath, sessionName, localPath, sshUrl) {
  const sessions = await listSyncSessionNames(mutagenPath);
  if (sessions.includes(sessionName)) {
    await execAsync(`"${mutagenPath}" sync resume "${sessionName}"`, { timeout: 10000 });
    return;
  }
  const local = path.resolve(localPath).replace(/\\/g, '/');
  await execAsync(
    `"${mutagenPath}" sync create "${local}" "${sshUrl}" --name "${sessionName}" --sync-mode two-way-resolved`,
    { timeout: 15000 }
  );
}

module.exports = {
  getMutagenPath,
  ensureMutagenPath,
  getMutagenBinaryName,
  getMutagenBinPath,
  getSessionName,
  getRemotePath,
  getSyncSshUrl,
  listSyncSessionNames,
  ensureSyncSession
};
