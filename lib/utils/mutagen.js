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
 * Resolve path to Mutagen binary. Prefers ~/.aifabrix/bin/, else PATH.
 * @returns {Promise<string|null>} Path to binary or null if not found
 */
async function getMutagenPath() {
  const preferred = getMutagenBinPath();
  if (fs.existsSync(preferred)) {
    return preferred;
  }
  try {
    const name = getMutagenBinaryName();
    const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    const { stdout } = await execAsync(cmd, { encoding: 'utf8', timeout: 1000 });
    const p = (stdout || '').trim().split('\n')[0].trim();
    return p || null;
  } catch {
    return null;
  }
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
 * Remote path for sync and Docker -v: user-mutagen-folder + '/dev/' + appKey
 * @param {string} userMutagenFolder - From config (no trailing slash)
 * @param {string} appKey - App key
 * @returns {string}
 */
function getRemotePath(userMutagenFolder, appKey) {
  const base = (userMutagenFolder || '').trim().replace(/\/+$/, '');
  return base ? `${base}/dev/${appKey}` : '';
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
  getMutagenBinaryName,
  getMutagenBinPath,
  getSessionName,
  getRemotePath,
  getSyncSshUrl,
  listSyncSessionNames,
  ensureSyncSession
};
