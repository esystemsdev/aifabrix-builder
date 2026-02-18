/**
 * @fileoverview Locate or generate SSH key for Mutagen sync (Windows and Mac). Prefer ed25519.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * Default SSH directory (user's .ssh)
 * @returns {string} Path to .ssh directory
 */
function getDefaultSshDir() {
  const home = os.homedir();
  return path.join(home, '.ssh');
}

/**
 * Path to default ed25519 public key
 * @returns {string} Path to id_ed25519.pub
 */
function getDefaultEd25519PublicKeyPath() {
  return path.join(getDefaultSshDir(), 'id_ed25519.pub');
}

/**
 * Path to default ed25519 private key
 * @returns {string} Path to id_ed25519
 */
function getDefaultEd25519PrivateKeyPath() {
  return path.join(getDefaultSshDir(), 'id_ed25519');
}

/**
 * Ensure .ssh directory exists
 * @param {string} [sshDir] - SSH directory (default: user .ssh)
 * @returns {string} Resolved SSH dir path
 */
function ensureSshDir(sshDir) {
  const dir = sshDir || getDefaultSshDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

/**
 * Generate ed25519 SSH key pair if it does not exist. Idempotent.
 * @param {string} [privateKeyPath] - Path to private key (default: ~/.ssh/id_ed25519)
 * @returns {string} Path to public key file
 * @throws {Error} If ssh-keygen fails
 */
function ensureEd25519Key(privateKeyPath) {
  const privPath = privateKeyPath || getDefaultEd25519PrivateKeyPath();
  const pubPath = privPath + '.pub';
  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    return pubPath;
  }
  ensureSshDir(path.dirname(privPath));
  execSync(`ssh-keygen -t ed25519 -f "${privPath}" -N "" -C "aifabrix"`, {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  return pubPath;
}

/**
 * Read public key content (single line). Prefer ed25519, fallback to id_rsa.pub.
 * @param {string} [sshDir] - SSH directory
 * @returns {string} Public key line (e.g. "ssh-ed25519 AAAA... aifabrix")
 * @throws {Error} If no key found or read fails
 */
function readPublicKeyContent(sshDir) {
  const dir = sshDir || getDefaultSshDir();
  const ed25519Pub = path.join(dir, 'id_ed25519.pub');
  const rsaPub = path.join(dir, 'id_rsa.pub');
  let pathToRead = null;
  if (fs.existsSync(ed25519Pub)) {
    pathToRead = ed25519Pub;
  } else if (fs.existsSync(rsaPub)) {
    pathToRead = rsaPub;
  }
  if (!pathToRead) {
    throw new Error(
      'No SSH public key found. Run: ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "aifabrix"'
    );
  }
  const content = fs.readFileSync(pathToRead, 'utf8').trim();
  const firstLine = content.split('\n')[0];
  if (!firstLine || !firstLine.startsWith('ssh-')) {
    throw new Error(`Invalid SSH public key file: ${pathToRead}`);
  }
  return firstLine;
}

/**
 * Get or create ed25519 key and return its public key content for POST /api/dev/users/:id/ssh-keys.
 * @returns {string} Single-line public key content
 */
function getOrCreatePublicKeyContent() {
  ensureEd25519Key();
  return readPublicKeyContent();
}

module.exports = {
  getDefaultSshDir,
  getDefaultEd25519PublicKeyPath,
  getDefaultEd25519PrivateKeyPath,
  ensureSshDir,
  ensureEd25519Key,
  readPublicKeyContent,
  getOrCreatePublicKeyContent
};
