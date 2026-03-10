/**
 * Unit tests for env-copy.js (resolveEnvOutputPath, substituteMntDataForLocal, local .env writers).
 *
 * @fileoverview Tests for /mnt/data substitution and mount directory creation when writing local .env
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

const {
  resolveEnvOutputPath,
  substituteMntDataForLocal
} = require('../../../lib/utils/env-copy');

describe('env-copy', () => {
  describe('resolveEnvOutputPath', () => {
    it('resolves relative envOutputPath against variables dir', () => {
      const variablesPath = path.join('/app', 'builder', 'myapp', 'application.yaml');
      expect(resolveEnvOutputPath('../../.env', variablesPath)).toBe(path.join('/app', '.env'));
    });

    it('appends .env when path is a directory', () => {
      const variablesPath = path.join('/app', 'builder', 'myapp', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      const statSync = jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true });
      expect(resolveEnvOutputPath('../..', variablesPath)).toBe(path.join('/app', '.env'));
      statSync.mockRestore();
    });
  });

  describe('substituteMntDataForLocal', () => {
    it('replaces /mnt/data with resolved mount path next to output .env', () => {
      const outputPath = path.join('/repo', 'root', '.env');
      const expectedMount = path.join('/repo', 'root', 'mount');
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      const content = 'LOG_PATH=/mnt/data/logs\nSTORAGE_PATH=/mnt/data/storage';
      const result = substituteMntDataForLocal(content, outputPath);

      expect(result).toBe(`LOG_PATH=${expectedMount}/logs\nSTORAGE_PATH=${expectedMount}/storage`);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedMount, { recursive: true });
    });

    it('creates mount directory when it does not exist', () => {
      const outputPath = path.join('/tmp', 'out', '.env');
      const mountPath = path.join('/tmp', 'out', 'mount');
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      substituteMntDataForLocal('X=/mnt/data\n', outputPath);

      expect(fs.existsSync).toHaveBeenCalledWith(mountPath);
      expect(fs.mkdirSync).toHaveBeenCalledWith(mountPath, { recursive: true });
    });

    it('does not call mkdirSync when mount directory already exists', () => {
      const outputPath = path.join('/tmp', 'out', '.env');
      const mountPath = path.join('/tmp', 'out', 'mount');
      fs.existsSync.mockImplementation((p) => p === mountPath);

      substituteMntDataForLocal('X=/mnt/data\n', outputPath);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('replaces all occurrences of /mnt/data in content', () => {
      const outputPath = path.join('/repo', '.env');
      const expectedMount = path.join('/repo', 'mount');
      fs.existsSync.mockReturnValue(true);

      const content = 'A=/mnt/data B=/mnt/data/logs C=/mnt/data/storage/file';
      const result = substituteMntDataForLocal(content, outputPath);

      expect(result).toBe(`A=${expectedMount} B=${expectedMount}/logs C=${expectedMount}/storage/file`);
    });

    it('leaves content without /mnt/data unchanged but still ensures mount dir exists', () => {
      const outputPath = path.join('/repo', '.env');
      const mountPath = path.join('/repo', 'mount');
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});

      const content = 'PORT=3000\nLOG_LEVEL=info';
      const result = substituteMntDataForLocal(content, outputPath);

      expect(result).toBe(content);
      expect(fs.mkdirSync).toHaveBeenCalledWith(mountPath, { recursive: true });
    });
  });
});
