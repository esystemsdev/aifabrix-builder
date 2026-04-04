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
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED'
];

const SSL_HOSTNAME_MISMATCH_CODES = ['ERR_TLS_CERT_ALTNAME_INVALID'];

/**
 * Walks err and nested err.cause (fetch wraps TLS failures).
 * @param {Error|undefined|null} err - Error chain root
 * @param {function(Error): void} fn - Visitor
 * @param {number} [maxDepth=12]
 */
function walkErrorCauseChain(err, fn, maxDepth = 12) {
  let e = err;
  let depth = 0;
  while (e && depth < maxDepth) {
    fn(e);
    e = e.cause;
    depth++;
  }
}

/**
 * Returns true if the error indicates an untrusted/self-signed server certificate.
 * @param {Error} err - Thrown error (e.g. from devApi.getHealth)
 * @returns {boolean}
 */
function isSslUntrustedError(err) {
  if (!err) return false;
  let untrusted = false;
  walkErrorCauseChain(err, (e) => {
    const code = e && e.code;
    const msg = ((e && e.message) || '').toUpperCase();
    if (SSL_UNTRUSTED_CODES.some(c => code === c || msg.includes(c))) {
      untrusted = true;
    }
  });
  return untrusted;
}

/**
 * True when the server cert is trusted enough to verify but the hostname does not match (wrong SAN).
 * Installing the dev CA does not fix this.
 * @param {Error} err - Thrown error
 * @returns {boolean}
 */
function isSslHostnameMismatchError(err) {
  if (!err) return false;
  let mismatch = false;
  walkErrorCauseChain(err, (e) => {
    const code = e && e.code;
    if (SSL_HOSTNAME_MISMATCH_CODES.includes(code)) {
      mismatch = true;
    }
  });
  return mismatch;
}

const MAX_INSTALL_CA_REDIRECTS = 5;
const PEM_CERT_BLOCK_RE = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/;
const JSON_CA_KEYS = [
  'caCertificate', 'ca', 'certificate', 'pem', 'rootCa', 'rootCertificate', 'caPem', 'data'
];

/**
 * One-line preview of a response body for errors (no PEM secrets expected in typical error HTML).
 * @param {string} body
 * @param {number} maxLen
 * @returns {string}
 */
function truncateBodyForError(body, maxLen = 180) {
  const oneLine = String(body || '').replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLen) return oneLine || '(empty)';
  return `${oneLine.slice(0, maxLen)}…`;
}

/**
 * @param {Object} j - Parsed JSON object
 * @returns {string|null} PEM or null
 */
function pemFromJsonObject(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  for (const k of JSON_CA_KEYS) {
    if (typeof j[k] !== 'string') continue;
    const m = j[k].match(PEM_CERT_BLOCK_RE);
    if (m) return m[0].trim();
  }
  return null;
}

/**
 * Extract first PEM certificate from install-ca response: raw PEM, JSON field, or HTML/text wrapper.
 * @param {string} raw - Response body as UTF-8
 * @returns {string|null} PEM text or null
 */
function extractCaPemFromBody(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  try {
    const fromJson = pemFromJsonObject(JSON.parse(s));
    if (fromJson) return fromJson;
  } catch {
    /* not JSON */
  }
  const block = s.match(PEM_CERT_BLOCK_RE);
  return block ? block[0].trim() : null;
}

/**
 * Resolve install-ca response body to PEM buffer or reject with context.
 * @param {import('http').IncomingMessage} res
 * @param {string} absoluteUrl
 * @param {Buffer[]} chunks
 * @param {function(Buffer):void} resolve
 * @param {function(Error):void} reject
 */
function finalizeInstallCaResponse(res, absoluteUrl, chunks, resolve, reject) {
  const body = Buffer.concat(chunks).toString('utf8');
  const status = res.statusCode || 0;
  if (status < 200 || status >= 300) {
    reject(
      new Error(
        `install-ca returned HTTP ${status}. ${truncateBodyForError(body)} — open ${absoluteUrl} in a browser or ask your admin to serve PEM at /install-ca.`
      )
    );
    return;
  }
  const pem = extractCaPemFromBody(body);
  if (!pem) {
    const hint = body.trim().startsWith('<') ? 'Received HTML (SPA or error page). ' : '';
    reject(
      new Error(
        `${hint}Invalid CA response: expected PEM certificate. ${truncateBodyForError(body)} — try: ${absoluteUrl}`
      )
    );
    return;
  }
  resolve(Buffer.from(`${pem}\n`, 'utf8'));
}

/**
 * GET absolute install-ca URL with insecure TLS; follow redirects (resolve relative Location).
 * @param {string} absoluteUrl - Full https URL
 * @param {number} redirectCount - Redirect depth
 * @returns {Promise<Buffer>} CA PEM
 */
function fetchInstallCaAbsolute(absoluteUrl, redirectCount) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_INSTALL_CA_REDIRECTS) {
      reject(new Error(`install-ca: too many redirects (max ${MAX_INSTALL_CA_REDIRECTS})`));
      return;
    }
    const urlObj = new URL(absoluteUrl);
    if (urlObj.protocol !== 'https:') {
      reject(new Error('install-ca requires https URL'));
      return;
    }
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.get(
      absoluteUrl,
      { agent },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.destroy();
          let nextUrl;
          try {
            nextUrl = new URL(res.headers.location, absoluteUrl).href;
          } catch {
            reject(new Error(`install-ca: invalid redirect Location: ${res.headers.location}`));
            return;
          }
          fetchInstallCaAbsolute(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => finalizeInstallCaResponse(res, absoluteUrl, chunks, resolve, reject));
      }
    );
    req.on('error', reject);
  });
}

/**
 * Fetch CA PEM from Builder Server via GET {baseUrl}/install-ca.
 * Uses rejectUnauthorized: false only for this endpoint (dev setup).
 * @param {string} baseUrl - Builder Server base URL (no trailing slash)
 * @returns {Promise<Buffer>} CA certificate PEM
 */
function fetchInstallCa(baseUrl) {
  const url = `${baseUrl.replace(/\/+$/, '')}/install-ca`;
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return Promise.reject(new Error('install-ca: invalid server URL'));
  }
  if (urlObj.protocol !== 'https:') {
    return Promise.reject(new Error('install-ca requires https URL'));
  }
  return fetchInstallCaAbsolute(urlObj.href, 0);
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

/**
 * True when installCaPlatform failed because Linux needs root to update the system CA store.
 * @param {unknown} err - Caught error
 * @returns {boolean}
 */
function isLinuxCaSudoRequiredError(err) {
  const msg = err && typeof err.message === 'string' ? err.message : '';
  return /Linux CA install requires sudo/i.test(msg);
}

module.exports = {
  isSslUntrustedError,
  isSslHostnameMismatchError,
  fetchInstallCa,
  installCaPlatform,
  promptInstallCa,
  isLinuxCaSudoRequiredError
};
