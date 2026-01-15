/**
 * Tests for Deployment Validation Helpers Module
 *
 * @fileoverview Unit tests for lib/utils/deployment-validation-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  processSuccessfulValidation,
  processValidationFailure,
  processValidationError,
  processUnexpectedValidationState,
  handleValidationResponse
} = require('../../../lib/utils/deployment-validation-helpers');

describe('Deployment Validation Helpers Module', () => {
  describe('processSuccessfulValidation', () => {
    it('should process successful validation response', () => {
      const responseData = {
        validateToken: 'token123',
        draftDeploymentId: 'deployment-id',
        imageServer: 'registry.example.com',
        imageUsername: 'user',
        imagePassword: 'pass',
        expiresAt: '2024-12-31T00:00:00Z'
      };

      const result = processSuccessfulValidation(responseData);

      expect(result).toEqual({
        success: true,
        validateToken: 'token123',
        draftDeploymentId: 'deployment-id',
        imageServer: 'registry.example.com',
        imageUsername: 'user',
        imagePassword: 'pass',
        expiresAt: '2024-12-31T00:00:00Z'
      });
    });

    it('should handle response with missing optional fields', () => {
      const responseData = {
        validateToken: 'token123',
        draftDeploymentId: 'deployment-id'
      };

      const result = processSuccessfulValidation(responseData);

      expect(result).toEqual({
        success: true,
        validateToken: 'token123',
        draftDeploymentId: 'deployment-id',
        imageServer: undefined,
        imageUsername: undefined,
        imagePassword: undefined,
        expiresAt: undefined
      });
    });
  });

  describe('processValidationFailure', () => {
    it('should throw error with validation errors', () => {
      const responseData = {
        valid: false,
        errors: ['Error 1', 'Error 2']
      };

      expect(() => processValidationFailure(responseData)).toThrow('Validation failed: Error 1, Error 2');
    });

    it('should throw error with default message when no errors array', () => {
      const responseData = {
        valid: false
      };

      expect(() => processValidationFailure(responseData)).toThrow('Validation failed: Invalid configuration');
    });

    it('should throw error with default message when errors array is empty', () => {
      const responseData = {
        valid: false,
        errors: []
      };

      expect(() => processValidationFailure(responseData)).toThrow('Validation failed: Invalid configuration');
    });

    it('should include status and data in error', () => {
      const responseData = {
        valid: false,
        errors: ['Error 1']
      };

      try {
        processValidationFailure(responseData);
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.data).toEqual(responseData);
      }
    });
  });

  describe('processValidationError', () => {
    it('should throw error with formatted error message', () => {
      const response = {
        success: false,
        formattedError: 'Custom error message',
        status: 500
      };

      expect(() => processValidationError(response)).toThrow('Validation request failed: Custom error message');
    });

    it('should throw error with error property when formattedError not available', () => {
      const response = {
        success: false,
        error: 'Error message',
        status: 400
      };

      expect(() => processValidationError(response)).toThrow('Validation request failed: Error message');
    });

    it('should throw error with default message when no error info', () => {
      const response = {
        success: false,
        status: 500
      };

      expect(() => processValidationError(response)).toThrow('Validation request failed: Unknown error');
    });

    it('should include status and data in error', () => {
      const response = {
        success: false,
        formattedError: 'Error',
        status: 500,
        data: { detail: 'Details' }
      };

      try {
        processValidationError(response);
      } catch (error) {
        expect(error.status).toBe(500);
        expect(error.data).toEqual({ detail: 'Details' });
      }
    });

    it('should use default status 400 when not provided', () => {
      const response = {
        success: false,
        formattedError: 'Error'
      };

      try {
        processValidationError(response);
      } catch (error) {
        expect(error.status).toBe(400);
      }
    });
  });

  describe('processUnexpectedValidationState', () => {
    it('should throw error for unexpected state', () => {
      const responseData = {
        valid: null
      };

      expect(() => processUnexpectedValidationState(responseData)).toThrow('Validation response is in an unexpected state');
    });

    it('should include status and data in error', () => {
      const responseData = {
        valid: null,
        other: 'data'
      };

      try {
        processUnexpectedValidationState(responseData);
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.data).toEqual(responseData);
      }
    });
  });

  describe('handleValidationResponse', () => {
    it('should handle successful validation with valid: true', () => {
      const response = {
        success: true,
        data: {
          valid: true,
          validateToken: 'token123',
          draftDeploymentId: 'deployment-id'
        }
      };

      const result = handleValidationResponse(response);

      expect(result).toEqual({
        success: true,
        validateToken: 'token123',
        draftDeploymentId: 'deployment-id',
        imageServer: undefined,
        imageUsername: undefined,
        imagePassword: undefined,
        expiresAt: undefined
      });
    });

    it('should handle successful validation with nested data structure', () => {
      const response = {
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'token123'
          }
        }
      };

      const result = handleValidationResponse(response);

      expect(result.success).toBe(true);
      expect(result.validateToken).toBe('token123');
    });

    it('should handle validation failure with valid: false', () => {
      const response = {
        success: true,
        data: {
          valid: false,
          errors: ['Error 1', 'Error 2']
        }
      };

      expect(() => handleValidationResponse(response)).toThrow('Validation failed: Error 1, Error 2');
    });

    it('should handle non-success response', () => {
      const response = {
        success: false,
        formattedError: 'API error',
        status: 500
      };

      expect(() => handleValidationResponse(response)).toThrow('Validation request failed: API error');
    });

    it('should handle unexpected state when valid is not true or false', () => {
      const response = {
        success: true,
        data: {
          valid: null
        }
      };

      expect(() => handleValidationResponse(response)).toThrow('Validation response is in an unexpected state');
    });

    it('should handle response with valid: undefined', () => {
      const response = {
        success: true,
        data: {
          // valid is undefined
        }
      };

      expect(() => handleValidationResponse(response)).toThrow('Validation response is in an unexpected state');
    });
  });
});

