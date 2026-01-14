/**
 * Tests for File Upload Utility
 *
 * @fileoverview Tests for lib/utils/file-upload.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');

// Mock fs before requiring file-upload
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn()
  }
}));

// Mock api utilities
const mockMakeApiCall = jest.fn();
const mockAuthenticatedApiCall = jest.fn();

jest.mock('../../../lib/utils/api', () => ({
  makeApiCall: mockMakeApiCall,
  authenticatedApiCall: mockAuthenticatedApiCall
}));

// Mock FormData and Blob (Node.js 18+ globals)
global.FormData = jest.fn().mockImplementation(() => {
  const data = new Map();
  return {
    append: jest.fn((key, value, filename) => {
      data.set(key, { value, filename });
    }),
    entries: jest.fn(() => data.entries()),
    get: jest.fn((key) => data.get(key))
  };
});

global.Blob = jest.fn().mockImplementation((parts, options) => {
  return {
    parts,
    type: options?.type || 'application/octet-stream'
  };
});

const { uploadFile } = require('../../../lib/utils/file-upload');

describe('File Upload Utility', () => {
  const url = 'https://api.example.com/upload';
  const filePath = '/path/to/test-file.yaml';
  const fileContent = Buffer.from('test file content');

  beforeEach(() => {
    jest.clearAllMocks();
    fs.access.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue(fileContent);
    mockMakeApiCall.mockResolvedValue({ success: true, data: {} });
    mockAuthenticatedApiCall.mockResolvedValue({ success: true, data: {} });
  });

  describe('uploadFile', () => {
    it('should upload file with default field name', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      const result = await uploadFile(url, filePath, 'file', authConfig);

      expect(fs.access).toHaveBeenCalledWith(filePath);
      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(global.FormData).toHaveBeenCalled();
      expect(mockAuthenticatedApiCall).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should upload file with custom field name', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await uploadFile(url, filePath, 'openapi-file', authConfig);

      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(mockAuthenticatedApiCall).toHaveBeenCalled();
    });

    it('should upload file with additional fields', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      const additionalFields = { version: '1.0', format: 'yaml' };
      await uploadFile(url, filePath, 'file', authConfig, additionalFields);

      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(mockAuthenticatedApiCall).toHaveBeenCalled();
    });

    it('should use client credentials authentication', async() => {
      const authConfig = {
        type: 'client-credentials',
        clientId: 'client-id',
        clientSecret: 'client-secret'
      };
      await uploadFile(url, filePath, 'file', authConfig);

      expect(mockMakeApiCall).toHaveBeenCalled();
      expect(mockAuthenticatedApiCall).not.toHaveBeenCalled();
    });

    it('should use makeApiCall when no auth config', async() => {
      await uploadFile(url, filePath, 'file', {});

      expect(mockMakeApiCall).toHaveBeenCalled();
      expect(mockAuthenticatedApiCall).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error if file does not exist', async() => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(uploadFile(url, '/nonexistent/file.yaml', 'file', {})).rejects.toThrow('File not found: /nonexistent/file.yaml');
    });

    it('should throw error if file cannot be read', async() => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(uploadFile(url, filePath, 'file', {})).rejects.toThrow('Permission denied');
    });

    it('should propagate API call errors', async() => {
      const errorResponse = {
        success: false,
        error: 'Upload failed',
        status: 500
      };
      mockAuthenticatedApiCall.mockResolvedValue(errorResponse);

      const result = await uploadFile(url, filePath, 'file', { type: 'bearer', token: 'token' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });
  });

  describe('file path handling', () => {
    it('should extract filename from path', async() => {
      const fullPath = '/some/deep/path/to/file.yaml';
      await uploadFile(url, fullPath, 'file', { type: 'bearer', token: 'token' });

      expect(fs.readFile).toHaveBeenCalledWith(fullPath);
      // Verify FormData was created and file was appended
      expect(global.FormData).toHaveBeenCalled();
    });
  });
});

