/**
 * @fileoverview Builder Server (dev) API – issue-cert, settings, users, SSH keys, secrets.
 * First call: issue-cert is public (no client cert). All other routes require client certificate:
 * when clientKeyPem is provided, requests use mTLS (TLS client cert); otherwise X-Client-Cert header only.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const https = require('https');
const { makeApiCall } = require('../utils/api');

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Encode PEM for use in X-Client-Cert header. HTTP header values must not contain newlines;
 * base64 produces a single-line value. Server should decode with Buffer.from(val, 'base64').toString('utf8').
 * @param {string} clientCertPem - PEM-encoded client certificate
 * @returns {string} Base64-encoded PEM for header
 */
function encodeCertForHeader(clientCertPem) {
  if (!clientCertPem || typeof clientCertPem !== 'string') return '';
  return Buffer.from(clientCertPem, 'utf8').toString('base64');
}

/**
 * Normalize base URL (no trailing slash)
 * @param {string} serverUrl - Base URL of Builder Server
 * @returns {string} Normalized URL
 */
function normalizeBaseUrl(serverUrl) {
  if (!serverUrl || typeof serverUrl !== 'string') {
    throw new Error('remote-server URL is required and must be a string');
  }
  return serverUrl.trim().replace(/\/+$/, '');
}

/**
 * Build full URL for an endpoint path
 * @param {string} baseUrl - Normalized base URL
 * @param {string} path - Path (e.g. /api/dev/issue-cert)
 * @returns {string} Full URL
 */
function buildUrl(baseUrl, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${p}`;
}

/**
 * Make request to Builder Server. Throws on !success with message from response or error.
 * @param {string} url - Full URL
 * @param {Object} options - Fetch options (method, headers, body)
 * @returns {Promise<Object>} result.data when success
 */
async function request(url, options = {}) {
  const fetchOptions = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  };
  if (options.body !== undefined) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  const result = await makeApiCall(url, fetchOptions);
  if (!result.success) {
    const msg = result.formattedError || result.error || result.message || `Request failed (${result.status})`;
    const err = new Error(msg);
    err.status = result.status;
    err.errorData = result.errorData;
    throw err;
  }
  return result.data;
}

/**
 * Build request options and TLS agent for mTLS request.
 * @param {string} url - Full URL
 * @param {Object} options - { method, headers, body }
 * @param {string} certPem - PEM client certificate
 * @param {string} keyPem - PEM client key
 * @returns {{ urlObj: URL, method: string, headers: Object, body: string|undefined, agent: https.Agent }}
 */
function buildMtlsRequestOptions(url, options, certPem, keyPem) {
  const urlObj = new URL(url);
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  let body = options.body;
  if (body !== undefined && typeof body !== 'string') {
    body = JSON.stringify(body);
  }
  if (body) {
    headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
  }
  const tlsOptions = { cert: certPem, key: keyPem, rejectUnauthorized: true };
  const agent = new https.Agent(tlsOptions);
  return { urlObj, method, headers, body, agent, tlsOptions };
}

/**
 * Handle mTLS response: collect body, parse JSON, resolve or reject.
 * @param {import('http').IncomingMessage} res - HTTP response
 * @param {Function} resolve - Promise resolve
 * @param {Function} reject - Promise reject
 */
function handleMtlsResponse(res, resolve, reject) {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = raw;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const msg = (data && (data.message || data.error)) || res.statusMessage || `Request failed (${res.statusCode})`;
      const err = new Error(msg);
      err.status = res.statusCode;
      err.errorData = data;
      reject(err);
    } else {
      resolve(data);
    }
  });
}

/**
 * Make request with mTLS (TLS client certificate). Uses Node https module so the client cert
 * is presented in the TLS handshake. Also sends X-Client-Cert header for backends that read it.
 * @param {string} url - Full URL (https only)
 * @param {Object} options - { method, headers, body }
 * @param {string} certPem - PEM-encoded client certificate
 * @param {string} keyPem - PEM-encoded client private key
 * @returns {Promise<Object>} response data when success
 */
function requestWithCertImpl(url, options, certPem, keyPem) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      reject(new Error('mTLS request requires https URL'));
      return;
    }
    const { method, headers, body, agent, tlsOptions } = buildMtlsRequestOptions(url, options, certPem, keyPem);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
        agent,
        ...tlsOptions
      },
      (res) => handleMtlsResponse(res, resolve, reject)
    );
    req.on('error', reject);
    req.setTimeout(DEFAULT_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`));
    });
    if (body) {
      req.write(body, 'utf8');
    }
    req.end();
  });
}

/**
 * Issue developer certificate (public; no client cert). POST /api/dev/issue-cert
 * @requiresPermission {BuilderServer} Public (no auth required)
 * @param {string} serverUrl - Builder Server base URL
 * @param {Object} body - IssueCertDto: developerId, pin, csr
 * @returns {Promise<Object>} IssueCertResponseDto: certificate, validDays, validNotAfter
 */
async function issueCert(serverUrl, body) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, '/api/dev/issue-cert'), { method: 'POST', body });
}

/**
 * Get health. GET /health (public)
 * @requiresPermission {BuilderServer} Public (no auth required)
 * @param {string} serverUrl - Builder Server base URL
 * @returns {Promise<Object>} HealthResponseDto: status, checks (dataDir, encryptionKey, ca, users, tokens)
 */
async function getHealth(serverUrl) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, '/health'));
}

/**
 * Get developer settings (cert-authenticated). GET /api/dev/settings
 * When clientKeyPem is provided, uses mTLS (TLS client cert); otherwise X-Client-Cert header only.
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert or mTLS)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM-encoded client certificate
 * @param {string} [clientKeyPem] - PEM-encoded client private key (enables mTLS when provided)
 * @returns {Promise<Object>} SettingsResponseDto
 */
async function getSettings(serverUrl, clientCertPem, clientKeyPem) {
  if (!clientCertPem || typeof clientCertPem !== 'string') {
    throw new Error('Client certificate PEM is required for getSettings');
  }
  const base = normalizeBaseUrl(serverUrl);
  const url = buildUrl(base, '/api/dev/settings');
  const reqOptions = { method: 'GET', headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) } };
  if (clientKeyPem && typeof clientKeyPem === 'string') {
    return requestWithCertImpl(url, reqOptions, clientCertPem, clientKeyPem);
  }
  return request(url, reqOptions);
}

/**
 * List developers. GET /api/dev/users
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @returns {Promise<Object[]>} Array of UserResponseDto (empty when none)
 */
async function listUsers(serverUrl, clientCertPem) {
  const base = normalizeBaseUrl(serverUrl);
  const data = await request(buildUrl(base, '/api/dev/users'), {
    method: 'GET',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) }
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Create developer. POST /api/dev/users
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {Object} body - CreateUserDto: developerId, name, email, optional groups
 * @returns {Promise<Object>} UserResponseDto
 */
async function createUser(serverUrl, clientCertPem, body) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, '/api/dev/users'), {
    method: 'POST',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) },
    body
  });
}

/**
 * Update developer. PATCH /api/dev/users/:id
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {string} id - Developer ID
 * @param {Object} body - UpdateUserDto: at least one of name, email, groups
 * @returns {Promise<Object>} UserResponseDto
 */
async function updateUser(serverUrl, clientCertPem, id, body) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, `/api/dev/users/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) },
    body
  });
}

/**
 * Delete developer. DELETE /api/dev/users/:id
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {string} id - Developer ID
 * @returns {Promise<Object>} DeletedResponseDto
 */
async function deleteUser(serverUrl, clientCertPem, id) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, `/api/dev/users/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) }
  });
}

/**
 * Create or regenerate one-time PIN. POST /api/dev/users/:id/pin
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {string} id - Developer ID
 * @returns {Promise<Object>} CreatePinResponseDto: pin, expiresAt
 */
async function createPin(serverUrl, clientCertPem, id) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, `/api/dev/users/${encodeURIComponent(id)}/pin`), {
    method: 'POST',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) }
  });
}

/**
 * List SSH keys for developer. GET /api/dev/users/:id/ssh-keys
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {string} id - Developer ID
 * @returns {Promise<Object[]>} Array of SshKeyItemDto
 */
async function listSshKeys(serverUrl, clientCertPem, id) {
  const base = normalizeBaseUrl(serverUrl);
  const data = await request(buildUrl(base, `/api/dev/users/${encodeURIComponent(id)}/ssh-keys`), {
    method: 'GET',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) }
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Add SSH public key for developer. POST /api/dev/users/:id/ssh-keys
 * When clientKeyPem is provided, uses mTLS (TLS client cert); otherwise X-Client-Cert header only.
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert or mTLS)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {string} id - Developer ID
 * @param {Object} body - AddSshKeyDto: publicKey, optional label
 * @param {string} [clientKeyPem] - PEM-encoded client private key (enables mTLS when provided)
 * @returns {Promise<Object>} SshKeyItemDto
 */
async function addSshKey(serverUrl, clientCertPem, id, body, clientKeyPem) {
  const base = normalizeBaseUrl(serverUrl);
  const url = buildUrl(base, `/api/dev/users/${encodeURIComponent(id)}/ssh-keys`);
  const reqOptions = {
    method: 'POST',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) },
    body
  };
  if (clientKeyPem && typeof clientKeyPem === 'string') {
    return requestWithCertImpl(url, reqOptions, clientCertPem, clientKeyPem);
  }
  return request(url, reqOptions);
}

/**
 * Remove SSH key by fingerprint. DELETE /api/dev/users/:id/ssh-keys/:fingerprint
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {string} id - Developer ID
 * @param {string} fingerprint - Key fingerprint
 * @returns {Promise<Object>} DeletedResponseDto
 */
async function removeSshKey(serverUrl, clientCertPem, id, fingerprint) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, `/api/dev/users/${encodeURIComponent(id)}/ssh-keys/${encodeURIComponent(fingerprint)}`), {
    method: 'DELETE',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) }
  });
}

/**
 * List secrets. GET /api/dev/secrets
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @returns {Promise<Object[]>} Array of SecretItemDto: name, value
 */
async function listSecrets(serverUrl, clientCertPem) {
  const base = normalizeBaseUrl(serverUrl);
  const data = await request(buildUrl(base, '/api/dev/secrets'), {
    method: 'GET',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) }
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Add or update secret. POST /api/dev/secrets
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {Object} body - AddSecretDto: key, value
 * @returns {Promise<Object>} AddSecretResponseDto
 */
async function addSecret(serverUrl, clientCertPem, body) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, '/api/dev/secrets'), {
    method: 'POST',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) },
    body
  });
}

/**
 * Delete secret by key. DELETE /api/dev/secrets/:key
 * @requiresPermission {BuilderServer} Client certificate (X-Client-Cert)
 * @param {string} serverUrl - Builder Server base URL
 * @param {string} clientCertPem - PEM client certificate
 * @param {string} key - Secret key
 * @returns {Promise<Object>} DeleteSecretResponseDto
 */
async function deleteSecret(serverUrl, clientCertPem, key) {
  const base = normalizeBaseUrl(serverUrl);
  return request(buildUrl(base, `/api/dev/secrets/${encodeURIComponent(key)}`), {
    method: 'DELETE',
    headers: { 'X-Client-Cert': encodeCertForHeader(clientCertPem) }
  });
}

module.exports = {
  issueCert,
  getHealth,
  getSettings,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  createPin,
  listSshKeys,
  addSshKey,
  removeSshKey,
  listSecrets,
  addSecret,
  deleteSecret,
  normalizeBaseUrl,
  buildUrl,
  encodeCertForHeader
};
