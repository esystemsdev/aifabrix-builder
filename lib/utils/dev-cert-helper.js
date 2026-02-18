/**
 * @fileoverview Helper for generating CSR and saving dev certificates (Builder Server onboarding)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

/**
 * Generate a key pair and CSR for developer certificate. Uses OpenSSL when available.
 * CN in CSR is set to dev-<developerId> per Builder Server convention.
 * @param {string} developerId - Developer ID (e.g. "01")
 * @returns {{ csrPem: string, keyPem: string }} PEM-encoded CSR and private key
 * @throws {Error} If OpenSSL is not available or generation fails
 */
function generateCSR(developerId) {
  if (!developerId || typeof developerId !== 'string') {
    throw new Error('developerId is required and must be a string');
  }
  const cn = `dev-${developerId}`;
  const tmpDir = path.join(os.tmpdir(), `aifabrix-csr-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const keyPath = path.join(tmpDir, 'key.pem');
  const csrPath = path.join(tmpDir, 'csr.pem');
  try {
    execSync(
      `openssl req -new -newkey rsa:2048 -keyout "${keyPath}" -nodes -subj "/CN=${cn}" -out "${csrPath}"`,
      { stdio: 'pipe', encoding: 'utf8' }
    );
    const keyPem = fs.readFileSync(keyPath, 'utf8');
    const csrPem = fs.readFileSync(csrPath, 'utf8');
    return { csrPem, keyPem };
  } catch (err) {
    if (err.message && (err.message.includes('openssl') || err.message.includes('ENOENT'))) {
      throw new Error(
        'OpenSSL is required for certificate generation. Install OpenSSL and ensure it is on PATH, or use a system that provides it (e.g. Git for Windows).'
      );
    }
    throw new Error(`CSR generation failed: ${err.message}`);
  } finally {
    try {
      fs.unlinkSync(keyPath);
      fs.unlinkSync(csrPath);
      fs.rmdirSync(tmpDir);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Return path to the directory where dev certificates are stored for a developer.
 * @param {string} configDir - Config directory (e.g. from getConfigDirForPaths())
 * @param {string} developerId - Developer ID
 * @returns {string} Absolute path to certs/<developerId>/
 */
function getCertDir(configDir, developerId) {
  return path.join(configDir, 'certs', developerId);
}

/**
 * Read client certificate PEM from cert dir (cert.pem).
 * @param {string} certDir - Directory containing cert.pem
 * @returns {string|null} PEM content or null if not found
 */
function readClientCertPem(certDir) {
  const certPath = path.join(certDir, 'cert.pem');
  try {
    return fs.readFileSync(certPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

module.exports = {
  generateCSR,
  getCertDir,
  readClientCertPem
};
