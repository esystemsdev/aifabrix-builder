/**
 * Deployment Validation Helper Functions
 *
 * Helper functions for processing deployment validation responses.
 * Separated from deployer.js to maintain file size limits.
 *
 * @fileoverview Deployment validation response processing helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Process successful validation response
 * @param {Object} responseData - Response data
 * @returns {Object} Validation result
 */
function processSuccessfulValidation(responseData) {
  return {
    success: true,
    validateToken: responseData.validateToken,
    draftDeploymentId: responseData.draftDeploymentId,
    imageServer: responseData.imageServer,
    imageUsername: responseData.imageUsername,
    imagePassword: responseData.imagePassword,
    expiresAt: responseData.expiresAt
  };
}

/**
 * Process validation failure response
 * @param {Object} responseData - Response data
 * @throws {Error} Validation error
 */
function processValidationFailure(responseData) {
  const errorMessage = responseData.errors && responseData.errors.length > 0
    ? `Validation failed: ${responseData.errors.join(', ')}`
    : 'Validation failed: Invalid configuration';
  const error = new Error(errorMessage);
  error.status = 400;
  error.data = responseData;
  throw error;
}

/**
 * Process validation error response
 * @param {Object} response - API response
 * @throws {Error} Validation error
 */
function processValidationError(response) {
  const error = new Error(`Validation request failed: ${response.formattedError || response.error || 'Unknown error'}`);
  error.status = response.status || 400;
  error.data = response.data;
  throw error;
}

/**
 * Process unexpected validation response state
 * @param {Object} responseData - Response data
 * @throws {Error} Unexpected state error
 */
function processUnexpectedValidationState(responseData) {
  const error = new Error('Validation response is in an unexpected state');
  error.status = 400;
  error.data = responseData;
  throw error;
}

/**
 * Handle validation response
 * @param {Object} response - API response
 * @returns {Object|null} Validation result or null if needs retry
 * @throws {Error} If validation fails
 */
function handleValidationResponse(response) {
  // Handle successful validation (200 OK with valid: true)
  if (response.success && response.data) {
    const responseData = response.data.data || response.data;
    if (responseData.valid === true) {
      return processSuccessfulValidation(responseData);
    }
    // Handle validation failure (valid: false)
    if (responseData.valid === false) {
      processValidationFailure(responseData);
    }
  }

  // Handle validation errors (non-success responses)
  if (!response.success) {
    processValidationError(response);
  }

  // If we get here, response.success is true but valid is not true and not false
  processUnexpectedValidationState(response.data);
}

module.exports = {
  processSuccessfulValidation,
  processValidationFailure,
  processValidationError,
  processUnexpectedValidationState,
  handleValidationResponse
};

