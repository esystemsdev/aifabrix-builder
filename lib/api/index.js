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
   * Create an API client instance
   * @param {string} baseUrl - Base URL for the API (controller URL)
   * @param {Object} [authConfig] - Authentication configuration
   * @param {string} [authConfig.type] - Auth type ('bearer' | 'client-credentials' | 'client-token')
   * @param {string} [authConfig.token] - Bearer token
   * @param {string} [authConfig.clientId] - Client ID
   * @param {string} [authConfig.clientSecret] - Client secret
   */
  constructor(baseUrl, authConfig = {}) {
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error('baseUrl is required and must be a string');
    }
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authConfig = authConfig;
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
   * @returns {Object} Request headers
   */
  _buildHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };

    // Add authentication headers based on authConfig
    if (this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token') {
      if (this.authConfig.token) {
        headers['Authorization'] = `Bearer ${this.authConfig.token}`;
      }
    } else if (this.authConfig.type === 'client-credentials') {
      if (this.authConfig.clientId) {
        headers['x-client-id'] = this.authConfig.clientId;
      }
      if (this.authConfig.clientSecret) {
        headers['x-client-secret'] = this.authConfig.clientSecret;
      }
    }

    return headers;
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

    if (this.authConfig.type === 'bearer' || this.authConfig.type === 'client-token') {
      // Pass full authConfig to enable proper token refresh using controller URL
      return await authenticatedApiCall(url, { method: 'GET', headers }, this.authConfig);
    }

    return await makeApiCall(url, { method: 'GET', headers });
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

    const requestOptions = {
      method: 'POST',
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
   * Make a PATCH request
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Request options
   * @param {Object} [options.body] - Request body (will be JSON stringified)
   * @param {Object} [options.headers] - Additional headers
   * @returns {Promise<Object>} API response
   */
  async patch(endpoint, options = {}) {
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

module.exports = {
  ApiClient
};

