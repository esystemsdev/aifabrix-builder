/**
 * @fileoverview Helper for generating CSR and saving dev certificates (Builder Server onboarding)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

/**
 * @param {string} dir
 * @returns {string|null}
 */
function tryOpenSSLExe(dir) {
  if (!dir) return null;
  const trimmed = dir.trim();
  if (!trimmed) return null;
  const exe = path.join(trimmed, 'openssl.exe');
  return fs.existsSync(exe) ? exe : null;
}

/**
 * Git for Windows often adds ...\\Git\\cmd to PATH but not ...\\Git\\usr\\bin (so `where openssl` fails).
 * @param {string} pathEnv
 * @returns {string|null}
 */
function findOpenSSLViaGitCmdOnPath(pathEnv) {
  if (!pathEnv || typeof pathEnv !== 'string') return null;
  const needle = `${path.sep}git${path.sep}cmd`.toLowerCase();
  for (const segment of pathEnv.split(path.delimiter)) {
    const normalized = path.normalize(segment.trim());
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    const cmdIdx = lower.lastIndexOf(needle);
    if (cmdIdx === -1) continue;
    const gitRoot = normalized.slice(0, cmdIdx + `${path.sep}git`.length);
    const fromUsrBin = tryOpenSSLExe(path.join(gitRoot, 'usr', 'bin'));
    if (fromUsrBin) return fromUsrBin;
  }
  return null;
}

/**
 * First openssl.exe found in PATH directory entries.
 * @param {string} pathEnv
 * @returns {string|null}
 */
function findOpenSSLInPathDirs(pathEnv) {
  if (!pathEnv || typeof pathEnv !== 'string') return null;
  for (const segment of pathEnv.split(path.delimiter)) {
    const found = tryOpenSSLExe(segment);
    if (found) return found;
  }
  return null;
}

/**
 * Windows: Git\\cmd on PATH without usr\\bin, per-user Git, standard install dirs.
 * @returns {string}
 */
function resolveOpenSSLExecutableWin32() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const pf64 = process.env.ProgramW6432 || pf;
  const localAppData = process.env.LOCALAPPDATA || '';
  const pathEnv = process.env.Path || process.env.PATH || '';

  const fromGitPath = findOpenSSLViaGitCmdOnPath(pathEnv);
  if (fromGitPath) return fromGitPath;

  const fromPathDirs = findOpenSSLInPathDirs(pathEnv);
  if (fromPathDirs) return fromPathDirs;

  const candidates = [
    path.join(pf64, 'Git', 'usr', 'bin', 'openssl.exe'),
    path.join(pf, 'Git', 'usr', 'bin', 'openssl.exe'),
    path.join(pf86, 'Git', 'usr', 'bin', 'openssl.exe'),
    localAppData ? path.join(localAppData, 'Programs', 'Git', 'usr', 'bin', 'openssl.exe') : '',
    path.join(pf64, 'OpenSSL-Win64', 'bin', 'openssl.exe'),
    path.join(pf, 'OpenSSL-Win64', 'bin', 'openssl.exe'),
    path.join(pf64, 'OpenSSL', 'bin', 'openssl.exe'),
    path.join(pf, 'OpenSSL', 'bin', 'openssl.exe')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'openssl.exe';
}

/**
 * Executable used for OpenSSL (PATH name or absolute path). Admin Windows shells often
 * omit Git usr\\bin; probe standard install locations when plain "openssl" is unavailable.
 * @returns {string}
 */
function resolveOpenSSLExecutable() {
  const fromEnv = process.env.AIFABRIX_OPENSSL;
  if (fromEnv && typeof fromEnv === 'string' && fs.existsSync(fromEnv.trim())) {
    return path.normalize(fromEnv.trim());
  }
  if (process.platform === 'win32') {
    return resolveOpenSSLExecutableWin32();
  }
  return 'openssl';
}

/**
 * Run OpenSSL with argv (no shell); works when openssl is only on disk, not on PATH.
 * @param {string[]} args
 * @param {Object} [opts] - Extra options for execFileSync (encoding utf8 applied by default)
 * @returns {string|Buffer}
 */
function runOpenSSL(args, opts) {
  const exe = resolveOpenSSLExecutable();
  return execFileSync(exe, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts
  });
}

/**
 * OpenSSL argv for CSR generation (CN is typically dev-01, dev-02, …).
 * @param {string} cn - Distinguished name CN value
 * @param {string} keyPath - Output key path
 * @param {string} csrPath - Output CSR path
 * @returns {string[]}
 */
function opensslCsrArgs(cn, keyPath, csrPath) {
  return [
    'req',
    '-new',
    '-newkey',
    'rsa:2048',
    '-keyout',
    keyPath,
    '-nodes',
    '-subj',
    `/CN=${cn}`,
    '-out',
    csrPath
  ];
}

/**
 * Map OpenSSL spawn/read failures to a clear Error for CSR generation.
 * @param {Error & { code?: string }} err
 * @returns {Error}
 */
function csrGenerationError(err) {
  const code = err && err.code;
  const msg = err && err.message ? String(err.message) : '';
  if (code === 'ENOENT') {
    return new Error(
      'OpenSSL is required for certificate generation. Install OpenSSL or Git for Windows, add Git usr\\bin or openssl to PATH, or set AIFABRIX_OPENSSL to the full path of openssl.exe.'
    );
  }
  const stderr = err && err.stderr ? String(err.stderr).trim() : '';
  if (typeof err.status === 'number' && err.status !== 0 && stderr) {
    return new Error(`OpenSSL failed: ${stderr}`);
  }
  return new Error(`CSR generation failed: ${msg}`);
}

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
    try {
      runOpenSSL(opensslCsrArgs(cn, keyPath, csrPath));
    } catch (sslErr) {
      throw csrGenerationError(sslErr);
    }
    const keyPem = fs.readFileSync(keyPath, 'utf8');
    const csrPem = fs.readFileSync(csrPath, 'utf8');
    return { csrPem, keyPem };
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

/**
 * Read client private key PEM from cert dir (key.pem). Used for mTLS (e.g. getSettings).
 * @param {string} certDir - Directory containing key.pem
 * @returns {string|null} PEM content or null if not found
 */
function readClientKeyPem(certDir) {
  const keyPath = path.join(certDir, 'key.pem');
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * Read Builder Server root CA PEM (ca.pem) for TLS verification in Node.
 * Node does not use the OS trust store the same way as browsers; this file is used with tls.rootCertificates.
 * @param {string} certDir - Directory containing ca.pem
 * @returns {string|null} PEM content or null if not found
 */
function readServerCaPem(certDir) {
  const caPath = path.join(certDir, 'ca.pem');
  try {
    return fs.readFileSync(caPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * Get certificate validity end (notAfter) from cert.pem in certDir using OpenSSL.
 * @param {string} certDir - Directory containing cert.pem
 * @returns {Date|null} Expiry date or null if cert missing/invalid or OpenSSL fails
 */
function getCertValidNotAfter(certDir) {
  const certPath = path.join(certDir, 'cert.pem');
  try {
    if (!fs.existsSync(certPath)) return null;
    const out = runOpenSSL(['x509', '-enddate', '-noout', '-in', certPath], { encoding: 'utf8' });
    const match = out.match(/notAfter=(.+)/);
    if (!match) return null;
    const date = new Date(match[1].trim());
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Normalize PEM: JSON-escaped \\n to real newlines (Docker/OpenSSL).
 * @param {string} pem
 * @returns {string}
 */
function normalizePemNewlines(pem) {
  if (typeof pem !== 'string') return pem;
  return pem.replace(/\\n/g, '\n');
}

/**
 * Distinct PEM blocks joined for ca.pem (HTTPS root + issue-cert CA, deduped).
 * @param {...(string|null|undefined)} pems
 * @returns {string|null}
 */
function mergeCaPemBlocks(...pems) {
  const blocks = [];
  const seen = new Set();
  for (const p of pems) {
    if (!p || typeof p !== 'string') continue;
    const normalized = normalizePemNewlines(p.trim());
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    blocks.push(normalized);
  }
  return blocks.length ? blocks.join('\n\n') : null;
}

module.exports = {
  generateCSR,
  getCertDir,
  readClientCertPem,
  readClientKeyPem,
  readServerCaPem,
  getCertValidNotAfter,
  normalizePemNewlines,
  mergeCaPemBlocks
};
