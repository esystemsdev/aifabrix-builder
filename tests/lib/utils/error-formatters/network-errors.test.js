/**
 * Tests for Network Error Formatters Module
 *
 * @fileoverview Unit tests for lib/utils/error-formatters/network-errors.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

const { formatNetworkError } = require('../../../../lib/utils/error-formatters/network-errors');

describe('Network Error Formatters Module', () => {
  describe('formatNetworkError', () => {
    it('should format ECONNREFUSED error', () => {
      const errorMessage = 'ECONNREFUSED';
      const errorData = { controllerUrl: 'http://localhost:3000' };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      expect(result).toContain('Cannot connect to controller');
      expect(result).toContain('Controller URL: http://localhost:3000');
      expect(result).toContain('Check if the controller is running');
    });

    it('should format ENOTFOUND error', () => {
      const errorMessage = 'ENOTFOUND example.com';
      const errorData = { controllerUrl: 'http://example.com:3000' };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      expect(result).toContain('Controller hostname not found');
      expect(result).toContain('Check your controller URL');
    });

    it('should format timeout error', () => {
      const errorMessage = 'Request timeout';
      const errorData = { controllerUrl: 'http://localhost:3000' };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      expect(result).toContain('Request timed out');
      expect(result).toContain('The controller may be overloaded');
    });

    it('should format generic network error', () => {
      const errorMessage = 'Some network error occurred';
      const errorData = { controllerUrl: 'http://localhost:3000' };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      expect(result).toContain('Some network error occurred');
    });

    it('should include correlation ID when present', () => {
      const errorMessage = 'ECONNREFUSED';
      const errorData = {
        controllerUrl: 'http://localhost:3000',
        correlationId: 'corr-123'
      };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Correlation ID: corr-123');
    });

    it('should handle error without controllerUrl', () => {
      const errorMessage = 'ECONNREFUSED';
      const errorData = {};
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      expect(result).toContain('Cannot connect to controller');
      expect(result).not.toContain('Controller URL:');
    });

    it('should handle null errorData', () => {
      const errorMessage = 'ECONNREFUSED';
      const result = formatNetworkError(errorMessage, null);

      expect(result).toContain('Network Error');
      expect(result).toContain('Cannot connect to controller');
    });

    it('should handle undefined errorData', () => {
      const errorMessage = 'ECONNREFUSED';
      const result = formatNetworkError(errorMessage, undefined);

      expect(result).toContain('Network Error');
      expect(result).toContain('Cannot connect to controller');
    });

    it('should normalize non-string error messages', () => {
      const errorMessage = 123;
      const errorData = {};
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      expect(result).toContain('123');
    });

    it('should handle empty error message', () => {
      const errorMessage = '';
      const errorData = {};
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      // Empty message gets normalized to 'Network error' and displayed as generic error
      expect(result).toContain('Network error');
    });

    it('should handle null error message', () => {
      const errorMessage = null;
      const errorData = {};
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Network Error');
      expect(result).toContain('Network error');
    });

    it('should format "Cannot connect" message as connection refused', () => {
      const errorMessage = 'Cannot connect to server';
      const errorData = { controllerUrl: 'http://localhost:3000' };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Cannot connect to controller');
      expect(result).toContain('Check if the controller is running');
    });

    it('should format "hostname not found" message as ENOTFOUND', () => {
      const errorMessage = 'hostname not found';
      const errorData = { controllerUrl: 'http://invalid.com:3000' };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Controller hostname not found');
      expect(result).toContain('Check your controller URL');
    });

    it('should format "timed out" message as timeout', () => {
      const errorMessage = 'Request timed out after 5000ms';
      const errorData = { controllerUrl: 'http://localhost:3000' };
      const result = formatNetworkError(errorMessage, errorData);

      expect(result).toContain('Request timed out');
      expect(result).toContain('The controller may be overloaded');
    });
  });
});

