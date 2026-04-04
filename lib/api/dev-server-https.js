/**
 * @fileoverview HTTPS JSON requests to Builder Server with dev root CA merged into Node TLS trust.
 * Node does not use the Windows/macOS user trust store for fetch; OS CA install alone is insufficient.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const https = require('https');
const tls = require('tls');

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Merge Mozilla roots (bundled in Node) with the dev Builder Server root CA.
 * @param {string} serverCaPem - PEM-encoded root CA
 * @returns {string[]|null} CA array for tls/https.Agent
 */
function mergedCaForDevServer(serverCaPem) {
  const pem = typeof serverCaPem === 'string' ? serverCaPem.trim() : '';
  if (!pem) return null;
  return [...tls.rootCertificates, pem];
}

/**
 * Collect response body, parse JSON, resolve or reject.
 * @param {import('http').IncomingMessage} res - HTTP response
 * @param {Function} resolve - Promise resolve
 * @param {Function} reject - Promise reject
 */
function handleJsonHttpsResponse(res, resolve, reject) {
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
 * @param {string} url
 * @param {{ method?: string, headers?: Object, body?: * }} options
 * @param {string} serverCaPem
 * @returns {{ urlObj: URL, method: string, headers: Object, body: string|undefined, ca: string[] }}
 */
function prepareHttpsJsonRequest(url, options, serverCaPem) {
  const urlObj = new URL(url);
  if (urlObj.protocol !== 'https:') {
    throw new Error('Builder Server requests require https URL');
  }
  const ca = mergedCaForDevServer(serverCaPem);
  if (!ca) {
    throw new Error('serverCaPem is required for httpsJsonRequest');
  }
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  let body = options.body;
  if (body !== undefined && typeof body !== 'string') {
    body = JSON.stringify(body);
  }
  if (body) {
    headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
  }
  return { urlObj, method, headers, body, ca };
}

/**
 * HTTPS JSON request with dev-server root CA (no client cert).
 * @param {string} url - Full https URL
 * @param {{ method?: string, headers?: Object, body?: * }} options - Request options
 * @param {string} serverCaPem - Dev root CA PEM
 * @returns {Promise<Object>} Parsed JSON body on success
 */
function httpsJsonRequest(url, options, serverCaPem) {
  return new Promise((resolve, reject) => {
    let parts;
    try {
      parts = prepareHttpsJsonRequest(url, options, serverCaPem);
    } catch (e) {
      reject(e);
      return;
    }
    const { urlObj, method, headers, body, ca } = parts;
    const agent = new https.Agent({ ca, rejectUnauthorized: true });
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
        agent,
        ca,
        rejectUnauthorized: true
      },
      (res) => handleJsonHttpsResponse(res, resolve, reject)
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
 * Use TLS client cert in the handshake only for https URLs (plain HTTP cannot carry mTLS).
 * @param {string} fullUrl - Request URL
 * @param {string} [clientKeyPem] - Client private key PEM
 * @returns {boolean}
 */
function shouldUseMtlsForUrl(fullUrl, clientKeyPem) {
  if (!clientKeyPem || typeof clientKeyPem !== 'string') {
    return false;
  }
  try {
    return new URL(fullUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  mergedCaForDevServer,
  httpsJsonRequest,
  DEFAULT_TIMEOUT_MS,
  shouldUseMtlsForUrl
};
