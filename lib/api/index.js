/**
 * @fileoverview Centralized API client for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { makeApiCall, authenticatedApiCall } = require('../utils/api');

/**
 * API Client class for making typed API calls
 * Wraps existing makeApiCall and authenticatedApiCall utilities
 * @class ApiClient
 */
class ApiClient {
  /**
   * Create an API client instance.
   * App endpoints receive token-only auth (Bearer). x-client-id/x-client-secret are used only for the controller token endpoint.
   * @param {string} baseUrl - Base URL for the API (controller URL)
   * @param {Object} [authConfig] - Authentication configuration
   * @param {string} [authConfig.type] - Auth type ('bearer' | 'client-token' | 'client-credentials')
   * @param {string} [authConfig.token] - Bearer token
   * @param {string} [authConfig.clientId] - Client ID (client-credentials)
   * @param {string} [authConfig.clientSecret] - Client secret (client-credentials)
   */
  constructor(baseUrl, authConfig = {}, clientOptions = {}) {
    if (baseUrl === null || baseUrl === undefined || typeof baseUrl !== 'string') {
      throw new Error('baseUrl is required and must be a string');
    }
    const trimmedUrl = baseUrl.trim().replace(/\/$/, ''); // Trim and remove trailing slash
    if (!trimmedUrl) {
      throw new Error('baseUrl cannot be empty. Please provide a valid URL.');
    }
    this.baseUrl = trimmedUrl;
    this.authConfig = authConfig;
    const opts = clientOptions && typeof clientOptions === 'object' ? clientOptions : {};
    this.enforceCliVersion = Boolean(opts.enforceCliVersion);
    this.controllerUrlForGate = opts.controllerUrl || null;
  }

  /**
   * Plan 142.0: block dataplane mutations when Builder CLI is below minimum.
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _ensureDataplaneCliVersionGate() {
    if (!this.enforceCliVersion) {
      return;
    }
    const { assertDataplaneCliVersionCompatible } = require('../utils/dataplane-cli-version-gate');
    await assertDataplaneCliVersionCompatible(this.baseUrl, {
      controllerUrl: this.controllerUrlForGate
    });
  }

  /**
   * Build full URL from endpoint path
   * @private
   * @param {string} endpoint - API endpoint path (e.g., '/api/v1/auth/token')
   * @returns {string} Full URL
   */
  _buildUrl(endpoint) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${path}`;
  }

  /**
   * Build request headers with authentication
   * @private
   * @param {Object} [additionalHeaders] - Additional headers to include
   * @param {Object} [opts] - Options
   * @param {boolean} [opts.skipContentType] - If true, do not set Content-Type (e.g. for FormData when boundary is set by fetch)
   * @returns {Object} Request headers
   */
  _buildHeaders(additionalHeaders = {}, opts = {}) {
    const headers = { ...additionalHeaders };
    if (!opts.skipContentType) {
      headers['Content-Type'] = 'application/json';
    }

    // User token (bearer) → Authorization: Bearer; application token (client-token) → x-client-token
    if (this.authConfig.token) {
      if (this.authConfig.type === 'client-token') {
        headers['x-client-token'] = this.authConfig.token;
      } else {
        headers['Authorization'] = `Bearer ${this.authConfig.token}`;
      }
    }
    return headers;
  }

  /**
   * True when endpoint is the controller client-credentials token exchange.
   * @private
   * @param {string} endpoint - API endpoint path
   * @returns {boolean}
   */
  _isClientCredentialsTokenEndpoint(endpoint) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return path === '/api/v1/auth/token';
  }

  /**
   * Add x-client-id/x-client-secret only for POST /api/v1/auth/token (never for app endpoints).
   * @private
   * @param {string} endpoint - API endpoint path
   * @param {Object} headers - Request headers built by _buildHeaders
   * @returns {Object}
   */
  _applyClientCredentialHeadersForTokenEndpoint(endpoint, headers) {
    if (this.authConfig.type !== 'client-credentials') {
      return headers;
    }
    if (!this._isClientCredentialsTokenEndpoint(endpoint)) {
      return headers;
    }
    const out = { ...headers };
    if (this.authConfig.clientId) {
      out['x-client-id'] = String(this.authConfig.clientId);
    }
    if (this.authConfig.clientSecret) {
      out['x-client-secret'] = String(this.authConfig.clientSecret);
    }
    return out;
  }

  /**
   * Make a GET request
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Request options
   * @param {Object} [options.headers] - Additional headers
   * @param {Object} [options.params] - Query parameters (will be converted to query string)
   * @returns {Promise<Object>} API response
   */
  async get(endpoint, options = {}) {
    await this._ensureDataplaneCliVersionGate();
    let url = this._buildUrl(endpoint);
    const headers = this._buildHeaders(options.headers);

    // Add query parameters if provided
    if (options.params) {
      const params = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const transport = { method: 'GET', headers };
    if (options.timeoutMs !== undefined && options.timeoutMs !== null) {
      transport.timeoutMs = options.timeoutMs;
    }

    if (this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token') {
      // Pass full authConfig to enable proper token refresh using controller URL
      return await authenticatedApiCall(url, transport, this.authConfig);
    }

    return await makeApiCall(url, transport);
  }

  /**
   * Make a POST request
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Request options
   * @param {Object} [options.body] - Request body (will be JSON stringified)
   * @param {Object} [options.headers] - Additional headers
   * @param {Object} [options.params] - Query parameters (will be converted to query string)
   * @returns {Promise<Object>} API response
   */
  async post(endpoint, options = {}) {
    await this._ensureDataplaneCliVersionGate();
    let url = this._buildUrl(endpoint);
    const headers = this._applyClientCredentialHeadersForTokenEndpoint(
      endpoint,
      this._buildHeaders(options.headers)
    );

    // Add query parameters if provided
    if (options.params) {
      const params = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const requestOptions = {
      method: 'POST',
      headers
    };

    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
    }

    if (options.timeoutMs !== undefined && options.timeoutMs !== null) {
      requestOptions.timeoutMs = options.timeoutMs;
    }

    if (this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token') {
      // Pass full authConfig to enable proper token refresh using controller URL
      return await authenticatedApiCall(url, requestOptions, this.authConfig);
    }

    return await makeApiCall(url, requestOptions);
  }

  /**
   * POST multipart/form-data (e.g. file upload). Uses same auth as other methods; does not set Content-Type so fetch sets boundary.
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {FormData} formData - FormData body
   * @param {Object} [options] - Request options
   * @param {Object} [options.headers] - Additional headers
   * @returns {Promise<Object>} API response
   */
  async postFormData(endpoint, formData, options = {}) {
    await this._ensureDataplaneCliVersionGate();
    const url = this._buildUrl(endpoint);
    const headers = this._buildHeaders(options.headers || {}, { skipContentType: true });

    const requestOptions = {
      method: 'POST',
      headers,
      body: formData
    };

    const hasToken = this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token';
    if (hasToken && this.authConfig.token) {
      return await authenticatedApiCall(url, requestOptions, this.authConfig);
    }

    return await makeApiCall(url, requestOptions);
  }

  /**
   * Make a PATCH request
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Request options
   * @param {Object} [options.body] - Request body (will be JSON stringified)
   * @param {Object} [options.headers] - Additional headers
   * @returns {Promise<Object>} API response
   */
  async patch(endpoint, options = {}) {
    await this._ensureDataplaneCliVersionGate();
    const url = this._buildUrl(endpoint);
    const headers = this._buildHeaders(options.headers);

    const requestOptions = {
      method: 'PATCH',
      headers
    };

    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
    }

    if (this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token') {
      // Pass full authConfig to enable proper token refresh using controller URL
      return await authenticatedApiCall(url, requestOptions, this.authConfig);
    }

    return await makeApiCall(url, requestOptions);
  }

  /**
   * Make a PUT request
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Request options
   * @param {Object} [options.body] - Request body (will be JSON stringified)
   * @param {Object} [options.headers] - Additional headers
   * @returns {Promise<Object>} API response
   */
  async put(endpoint, options = {}) {
    await this._ensureDataplaneCliVersionGate();
    const url = this._buildUrl(endpoint);
    const headers = this._buildHeaders(options.headers);

    const requestOptions = {
      method: 'PUT',
      headers
    };

    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
    }

    if (this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token') {
      // Pass full authConfig to enable proper token refresh using controller URL
      return await authenticatedApiCall(url, requestOptions, this.authConfig);
    }

    return await makeApiCall(url, requestOptions);
  }

  /**
   * Make a DELETE request
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Request options
   * @param {Object} [options.headers] - Additional headers
   * @returns {Promise<Object>} API response
   */
  async delete(endpoint, options = {}) {
    await this._ensureDataplaneCliVersionGate();
    const url = this._buildUrl(endpoint);
    const headers = this._buildHeaders(options.headers);

    const requestOptions = {
      method: 'DELETE',
      headers
    };

    if (this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token') {
      // Pass full authConfig to enable proper token refresh using controller URL
      return await authenticatedApiCall(url, requestOptions, this.authConfig);
    }

    return await makeApiCall(url, requestOptions);
  }
}

/**
 * Dataplane-scoped client — enforces Builder CLI version gate before each request.
 * Do not use for `fetchDataplaneGeneralHealth` (health must stay ungated).
 *
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options]
 * @param {string} [options.controllerUrl] - Controller URL for device cache lookup
 * @returns {ApiClient}
 */
function createDataplaneApiClient(dataplaneUrl, authConfig, options = {}) {
  return new ApiClient(dataplaneUrl, authConfig, {
    enforceCliVersion: true,
    controllerUrl: options.controllerUrl
  });
}

module.exports = {
  ApiClient,
  createDataplaneApiClient
};

