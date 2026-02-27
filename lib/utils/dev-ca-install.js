/**
 * Dev CA Install – SSL untrusted detection, fetch CA from Builder Server, install into OS trust store.
 * Used by `aifabrix dev init` when the server certificate is self-signed. Only /install-ca uses
 * rejectUnauthorized: false; all other requests use default TLS verification.
 *
 * @fileoverview CA install utilities for development Builder Server
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const os = require('os');
const { execFileSync } = require('child_process');
const readline = require('readline');
const chalk = require('chalk');

const SSL_UNTRUSTED_CODES = [
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_UNTRUSTED',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
];

/**
 * Returns true if the error indicates an untrusted/self-signed server certificate.
 * @param {Error} err - Thrown error (e.g. from devApi.getHealth)
 * @returns {boolean}
 */
function isSslUntrustedError(err) {
  const code = err?.code || err?.cause?.code;
  const msg = (err?.message || '').toUpperCase();
  return SSL_UNTRUSTED_CODES.some(c => code === c || msg.includes(c));
}

/**
 * Fetch CA PEM from Builder Server via GET {baseUrl}/install-ca.
 * Uses rejectUnauthorized: false only for this endpoint (dev setup).
 * @param {string} baseUrl - Builder Server base URL (no trailing slash)
 * @returns {Promise<Buffer>} CA certificate PEM
 */
function fetchInstallCa(baseUrl) {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl.replace(/\/+$/, '')}/install-ca`;
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      reject(new Error('install-ca requires https URL'));
      return;
    }
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.get(
      url,
      { agent },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          req.destroy();
          fetchInstallCa(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (!body || !body.includes('-----BEGIN CERTIFICATE-----')) {
            reject(new Error('Invalid CA response: expected PEM certificate'));
            return;
          }
          resolve(Buffer.from(body, 'utf8'));
        });
      }
    );
    req.on('error', reject);
  });
}

/**
 * Install CA PEM into OS trust store (platform-specific).
 * @param {Buffer|string} caPem - CA certificate PEM
 * @param {string} baseUrl - Builder Server base URL (for help link)
 * @returns {Promise<void>}
 */
async function installCaPlatform(caPem, baseUrl) {
  const pem = Buffer.isBuffer(caPem) ? caPem.toString('utf8') : String(caPem);
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, 'aifabrix-root-ca.crt');
  await fs.writeFile(tmpPath, pem, { mode: 0o644 });

  try {
    if (process.platform === 'win32') {
      execFileSync('certutil', ['-addstore', '-user', 'ROOT', tmpPath], { stdio: 'inherit' });
    } else if (process.platform === 'darwin') {
      const keychain = path.join(os.homedir(), 'Library', 'Keychains', 'login.keychain-db');
      execFileSync('security', ['add-trusted-cert', '-d', '-r', 'trustRoot', '-k', keychain, tmpPath], { stdio: 'inherit' });
    } else if (process.platform === 'linux') {
      const certPath = '/usr/local/share/ca-certificates/aifabrix-root-ca.crt';
      try {
        await fs.writeFile(certPath, pem, { mode: 0o644 });
        execFileSync('update-ca-certificates', [], { stdio: 'inherit' });
      } catch (e) {
        if (e.code === 'EACCES' || (e.status !== undefined && e.status !== null && e.status !== 0)) {
          const helpUrl = `${baseUrl.replace(/\/+$/, '')}/install-ca-help`;
          throw new Error(
            `Linux CA install requires sudo. Save CA manually from ${helpUrl} to ${certPath} and run: sudo update-ca-certificates`
          );
        }
        throw e;
      }
    } else {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

/**
 * Prompt user: "Download and install the development CA? (y/n)"
 * @returns {Promise<boolean>}
 */
function promptInstallCa() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(chalk.yellow('Server certificate not trusted. Download and install the development CA? (y/n) '), answer => {
      rl.close();
      const normalized = (answer || '').trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

module.exports = {
  isSslUntrustedError,
  fetchInstallCa,
  installCaPlatform,
  promptInstallCa
};
