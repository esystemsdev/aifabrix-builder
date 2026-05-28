/**
 * Poll helpers for environment deploy status (deployment-by-ID).
 *
 * @fileoverview Parse pipeline/environments deployment poll responses and fail fast on terminal HTTP errors
 * @author AI Fabrix Team
 * @version 1.0.0
 */

const TERMINAL_POLL_HTTP_STATUSES = new Set([400, 401, 403, 404, 410, 422]);

/**
 * @param {Object|null|undefined} response - API client response
 * @returns {boolean}
 */
function isTerminalPollApiResponse(response) {
  return Boolean(
    response &&
    response.success === false &&
    typeof response.status === 'number' &&
    TERMINAL_POLL_HTTP_STATUSES.has(response.status)
  );
}

/**
 * @param {Object|null|undefined} response - Successful API client response
 * @returns {Object|null} Deployment record or null
 */
function extractDeploymentRecord(response) {
  if (!response || response.success === false) {
    return null;
  }
  if (response?.data?.data) {
    return response.data.data;
  }
  if (response?.data && typeof response.data === 'object' && response.data.status) {
    return response.data;
  }
  return null;
}

/**
 * @param {Object|null|undefined} pipelineRes
 * @param {Object|null|undefined} envRes
 * @returns {Error}
 */
/**
 * @param {string} requestedEnvKey
 * @param {Error} error
 * @returns {Error}
 */
function enrichPollTerminalError(requestedEnvKey, error) {
  if (!error?.pollTerminal || error.status !== 404) {
    return error;
  }
  const base = error.message || '';
  if (!base.includes('Environment with key')) {
    return error;
  }
  error.message =
    `${base}\n\n` +
    'The deployment may have been created under a different environment key ' +
    '(for example evaluation-mode fallback to miso). Check controller logs for ' +
    `effectiveEnvironmentKey, register '${requestedEnvKey}' in the controller, or run ` +
    'aifabrix env deploy miso.';
  return error;
}

function buildPollStatusError(pipelineRes, envRes) {
  const terminal = [pipelineRes, envRes].filter(isTerminalPollApiResponse);
  const source = terminal[0] || pipelineRes || envRes;
  const message = source?.formattedError || source?.error || 'Unable to retrieve deployment status';
  const err = new Error(message);
  err.pollTerminal = true;
  if (typeof source?.status === 'number') {
    err.status = source.status;
  }
  return err;
}

/**
 * Fetches deployment status by ID (pipeline endpoint first, then environments).
 *
 * @async
 * @param {Function} getPipelineDeployment - pipeline.api getPipelineDeployment
 * @param {Function} getDeployment - deployments.api getDeployment
 * @param {string} controllerUrl
 * @param {string} envKey
 * @param {string} deploymentId
 * @param {Object} apiAuthConfig
 * @returns {Promise<Object|null>} Deployment record or null when status is not yet available (retry)
 * @throws {Error} When both endpoints return a terminal HTTP error (e.g. environment not found)
 */
async function fetchDeploymentStatusById(
  getPipelineDeployment,
  getDeployment,
  controllerUrl,
  envKey,
  deploymentId,
  apiAuthConfig
) {
  let pipelineRes;
  let envRes;

  try {
    pipelineRes = await getPipelineDeployment(controllerUrl, envKey, deploymentId, apiAuthConfig);
    const fromPipeline = extractDeploymentRecord(pipelineRes);
    if (fromPipeline) {
      return fromPipeline;
    }
  } catch (err) {
    pipelineRes = { success: false, error: err?.message || String(err) };
  }

  try {
    envRes = await getDeployment(controllerUrl, envKey, deploymentId, apiAuthConfig);
    const fromEnv = extractDeploymentRecord(envRes);
    if (fromEnv) {
      return fromEnv;
    }
  } catch (err) {
    envRes = { success: false, error: err?.message || String(err) };
  }

  if (isTerminalPollApiResponse(pipelineRes) || isTerminalPollApiResponse(envRes)) {
    throw buildPollStatusError(pipelineRes, envRes);
  }

  return null;
}

module.exports = {
  TERMINAL_POLL_HTTP_STATUSES,
  isTerminalPollApiResponse,
  extractDeploymentRecord,
  enrichPollTerminalError,
  buildPollStatusError,
  fetchDeploymentStatusById
};
