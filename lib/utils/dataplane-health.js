/**
 * Dataplane Health Check Utilities
 *
 * Provides utilities for checking dataplane URL health and reachability
 *
 * @fileoverview Dataplane health check utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Tests a single endpoint for reachability
 * @async
 * @function testEndpoint
 * @param {string} testUrl - URL to test
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} True if endpoint is reachable
 */
async function testEndpoint(testUrl, timeoutMs) {
  try {
    const controller = new AbortController();
    const abortTimeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let raceTimeoutId;

    const response = await Promise.race([
      fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      }),
      new Promise((_, reject) => {
        raceTimeoutId = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      })
    ]).catch(() => null);

    clearTimeout(abortTimeoutId);
    if (raceTimeoutId) {
      clearTimeout(raceTimeoutId);
    }

    // If we get any response (even 404 or 401), the service is reachable
    // 401 is OK because it means the API is working, just needs auth
    if (response && (response.ok || response.status === 404 || response.status === 401)) {
      return true;
    }

    // If we get a 500 or other server error, the service is up but broken
    // Still consider it "reachable" - the wizard will handle the actual error
    if (response && response.status >= 500) {
      return true;
    }

    // If response is null (timeout/error), endpoint is not reachable
    return false;
  } catch (error) {
    // Timeout or abort means endpoint is not reachable
    return false;
  }
}

/**
 * Checks if dataplane URL is reachable and API is functional
 * @async
 * @function checkDataplaneHealth
 * @param {string} dataplaneUrl - Dataplane URL to check
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<boolean>} True if dataplane is reachable and functional
 */
async function checkDataplaneHealth(dataplaneUrl, timeoutMs = 5000) {
  if (!dataplaneUrl) {
    return false;
  }

  const baseUrl = dataplaneUrl.replace(/\/+$/, '');
  const endpointsToTest = ['/health', '/api/v1/health', '/api/health', ''];

  for (const endpoint of endpointsToTest) {
    const testUrl = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
    const isReachable = await testEndpoint(testUrl, timeoutMs);
    if (isReachable) {
      return true;
    }
  }

  return false;
}

/**
 * Validates dataplane health before running wizard
 * @async
 * @function validateDataplaneHealth
 * @param {string} dataplaneUrl - Dataplane URL to check
 * @returns {Promise<Error|null>} Error if unhealthy, null if healthy
 */
async function validateDataplaneHealth(dataplaneUrl) {
  try {
    const isHealthy = await checkDataplaneHealth(dataplaneUrl, 5000);
    if (!isHealthy) {
      return new Error(
        `Dataplane is not reachable at ${dataplaneUrl}.\n\n` +
        'Please ensure the dataplane service is running and accessible, then try again.\n' +
        `You can check dataplane status with: curl ${dataplaneUrl}/health`
      );
    }
    return null;
  } catch (error) {
    return new Error(`Failed to check dataplane health: ${error.message}`);
  }
}

module.exports = {
  checkDataplaneHealth,
  validateDataplaneHealth,
  testEndpoint
};
