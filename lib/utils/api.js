/**
 * AI Fabrix Builder API Utilities
 *
 * Helper functions for making API calls to the controller
 * Supports both bearer token and ClientId/Secret authentication
 *
 * @fileoverview API calling utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Make an API call with proper error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response object with success flag
 */
async function makeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || 'Unknown error';
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }
      return {
        success: false,
        error: errorMessage,
        status: response.status
      };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return {
        success: true,
        data,
        status: response.status
      };
    }

    const text = await response.text();
    return {
      success: true,
      data: text,
      status: response.status
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      network: true
    };
  }
}

/**
 * Make an authenticated API call with bearer token
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {string} token - Bearer token
 * @returns {Promise<Object>} Response object
 */
async function authenticatedApiCall(url, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return makeApiCall(url, {
    ...options,
    headers
  });
}

module.exports = {
  makeApiCall,
  authenticatedApiCall
};

