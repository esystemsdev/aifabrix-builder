/**
 * @fileoverview HTTPS requests to Builder Server with TLS client certificate (mTLS).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const https = require('https');
const { mergedCaForDevServer, DEFAULT_TIMEOUT_MS } = require('./dev-server-https');

/**
 * Build request options and TLS agent for mTLS request.
 * @param {string} url - Full URL
 * @param {Object} options - { method, headers, body }
 * @param {string} certPem - PEM client certificate
 * @param {string} keyPem - PEM client key
 * @param {string} [serverCaPem] - Optional dev root CA
 * @returns {{ urlObj: URL, method: string, headers: Object, body: string|undefined, agent: https.Agent, tlsOptions: Object }}
 */
function buildMtlsRequestOptions(url, options, certPem, keyPem, serverCaPem) {
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
  const merged = mergedCaForDevServer(serverCaPem);
  const tlsOptions = { cert: certPem, key: keyPem, rejectUnauthorized: true };
  if (merged) {
    tlsOptions.ca = merged;
  }
  const agent = new https.Agent(tlsOptions);
  return { urlObj, method, headers, body, agent, tlsOptions };
}

/**
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
 * mTLS JSON request (https only). Sends X-Client-Cert header from options if present.
 * @param {string} url - Full https URL
 * @param {Object} options - { method, headers, body }
 * @param {string} certPem - Client certificate PEM
 * @param {string} keyPem - Client key PEM
 * @param {string} [serverCaPem] - Dev root CA PEM
 * @returns {Promise<Object>}
 */
function requestWithClientCert(url, options, certPem, keyPem, serverCaPem) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      reject(new Error('mTLS request requires https URL'));
      return;
    }
    const { method, headers, body, agent, tlsOptions } = buildMtlsRequestOptions(
      url, options, certPem, keyPem, serverCaPem
    );
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

module.exports = { requestWithClientCert };
