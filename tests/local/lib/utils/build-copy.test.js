/**
 * Tests for Build Copy Utilities
 *
 * @fileoverview Comprehensive tests for build-copy module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');

// Ensure fs is not mocked - use jest.unmock to prevent mocking
jest.unmock('fs');

// Use real fs implementation - use regular require after unmocking
// This ensures all file operations use the real filesystem
const fs = jest.requireActual('fs').promises;
const fsSync = jest.requireActual('fs');

// Variable for module to be loaded after reset
let buildCopy;

describe('Build Copy Utilities', () => {
  let tempDir;
  let originalCwd;
  let originalHomedir;

  beforeAll(() => {
    // Reset modules and re-require to get fresh module with real fs
    jest.resetModules();
    jest.unmock('fs');
    buildCopy = require('../../../../lib/utils/build-copy');
  });

  beforeEach(() => {
    // Create temporary directory for each test
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-build-copy-test-'));
    originalCwd = process.cwd();
    originalHomedir = os.homedir();
    process.chdir(tempDir);

    // Mock os.homedir() to return temp directory to avoid writing to real home directory
    jest.spyOn(os, 'homedir').mockReturnValue(tempDir);
  });

  describe('string developerId preservation', () => {
    it('should preserve developerId "01" in target directory', async() => {
      const appName = 'test-app';
      const developerId = '01';
      // Use path.join with process.cwd() to match getBuilderPath behavior
      const builderPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      const dirStats = fsSync.statSync(builderPath);
      expect(dirStats.isDirectory()).toBe(true);

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);
      const expectedPath = path.join(tempDir, '.aifabrix', 'applications-dev-01');
      expect(devDir).toBe(expectedPath);
      expect(fsSync.statSync(path.join(devDir, 'variables.yaml')).isFile()).toBe(true);
    });
  });

  afterEach(async() => {
    // Restore os.homedir mock
    jest.restoreAllMocks();

    // Clean up temporary directory (which now contains .aifabrix)
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('copyBuilderToDevDirectory', () => {
    it('should copy builder directory to developer-specific directory for dev > 0', async() => {
      const appName = 'test-app';
      const developerId = 1;
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });
      // Create builder directory with files (use sync to ensure it's created)
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, 'Dockerfile'), 'FROM node:18', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      expect(fsSync.statSync(builderPath).isDirectory()).toBe(true);

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      expect(devDir).toBeDefined();
      // Verify path is correct for dev > 0 (root of applications-dev-{id})
      const expectedPath = path.join(tempDir, '.aifabrix', `applications-dev-${developerId}`);
      expect(devDir).toBe(expectedPath);

      // Verify directory exists
      expect(() => fsSync.statSync(devDir).isDirectory()).not.toThrow();
      expect(fsSync.statSync(devDir).isDirectory()).toBe(true);

      // Verify files were copied
      const variablesPath = path.join(devDir, 'variables.yaml');
      const dockerfilePath = path.join(devDir, 'Dockerfile');
      expect(() => fsSync.statSync(variablesPath).isFile()).not.toThrow();
      expect(fsSync.statSync(variablesPath).isFile()).toBe(true);
      expect(() => fsSync.statSync(dockerfilePath).isFile()).not.toThrow();
      expect(fsSync.statSync(dockerfilePath).isFile()).toBe(true);

      // Verify file contents
      const variablesContent = await fs.readFile(variablesPath, 'utf8');
      expect(variablesContent).toBe('test: value');
    });

    it('should copy builder directory to applications/ for developer ID 0', async() => {
      const appName = 'test-app';
      const developerId = 0;
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });
      // Create builder directory with files (use sync to ensure it's created)
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, 'Dockerfile'), 'FROM node:18', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      expect(fsSync.statSync(builderPath).isDirectory()).toBe(true);

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      expect(devDir).toBeDefined();
      // Verify path is correct for dev 0
      const expectedPath = path.join(tempDir, '.aifabrix', 'applications');
      expect(devDir).toBe(expectedPath);

      // Verify directory exists
      expect(() => fsSync.statSync(devDir).isDirectory()).not.toThrow();
      expect(fsSync.statSync(devDir).isDirectory()).toBe(true);

      // Verify files were copied directly to applications/
      const variablesPath = path.join(devDir, 'variables.yaml');
      const dockerfilePath = path.join(devDir, 'Dockerfile');
      expect(() => fsSync.statSync(variablesPath).isFile()).not.toThrow();
      expect(fsSync.statSync(variablesPath).isFile()).toBe(true);
      expect(() => fsSync.statSync(dockerfilePath).isFile()).not.toThrow();
      expect(fsSync.statSync(dockerfilePath).isFile()).toBe(true);

      // Verify file contents
      const variablesContent = await fs.readFile(variablesPath, 'utf8');
      expect(variablesContent).toBe('test: value');
    });

    it('should throw error when builder directory does not exist', async() => {
      const appName = 'nonexistent-app';
      const developerId = 1;

      await expect(
        buildCopy.copyBuilderToDevDirectory(appName, developerId)
      ).rejects.toThrow(`Builder directory not found: ${path.join(process.cwd(), 'builder', appName)}\nRun 'aifabrix create ${appName}' first`);
    });

    it('should copy nested directories recursively', async() => {
      const appName = 'test-app';
      const developerId = 1;
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });
      // Create builder directory with nested structure
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.mkdirSync(path.join(builderPath, 'config'), { recursive: true });
      fsSync.mkdirSync(path.join(builderPath, 'scripts'), { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, 'config', 'app.yaml'), 'app: config', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, 'scripts', 'start.sh'), '#!/bin/bash', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      const dirStats = fsSync.statSync(builderPath);
      expect(dirStats.isDirectory()).toBe(true);

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      // Verify nested directories were copied
      expect(() => fsSync.statSync(path.join(devDir, 'config')).isDirectory()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'config')).isDirectory()).toBe(true);
      expect(() => fsSync.statSync(path.join(devDir, 'scripts')).isDirectory()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'scripts')).isDirectory()).toBe(true);
      expect(() => fsSync.statSync(path.join(devDir, 'config', 'app.yaml')).isFile()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'config', 'app.yaml')).isFile()).toBe(true);
      expect(() => fsSync.statSync(path.join(devDir, 'scripts', 'start.sh')).isFile()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'scripts', 'start.sh')).isFile()).toBe(true);
    });

    it('should skip hidden files and directories except .env and .gitignore', async() => {
      const appName = 'test-app';
      const developerId = 1;
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });
      // Create builder directory with various files
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, '.env'), 'ENV_VAR=value', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, '.gitignore'), 'node_modules/', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, '.hidden-file'), 'should be skipped', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, '.another-hidden'), 'should be skipped', 'utf8');
      fsSync.mkdirSync(path.join(builderPath, '.hidden-dir'), { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, '.hidden-dir', 'file.txt'), 'should be skipped', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      const dirStats = fsSync.statSync(builderPath);
      expect(dirStats.isDirectory()).toBe(true);

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      // Verify .env and .gitignore were copied
      expect(() => fsSync.statSync(path.join(devDir, '.env')).isFile()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, '.env')).isFile()).toBe(true);
      expect(() => fsSync.statSync(path.join(devDir, '.gitignore')).isFile()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, '.gitignore')).isFile()).toBe(true);

      // Verify hidden files and directories were skipped
      expect(() => fsSync.statSync(path.join(devDir, '.hidden-file'))).toThrow();
      expect(() => fsSync.statSync(path.join(devDir, '.another-hidden'))).toThrow();
      expect(() => fsSync.statSync(path.join(devDir, '.hidden-dir'))).toThrow();
    });

    it('should handle multiple developer IDs', async() => {
      const appName = 'test-app';
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });

      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      const dirStats = fsSync.statSync(builderPath);
      expect(dirStats.isDirectory()).toBe(true);

      const devDir1 = await buildCopy.copyBuilderToDevDirectory(appName, 1);
      const devDir2 = await buildCopy.copyBuilderToDevDirectory(appName, 2);

      expect(devDir1).not.toBe(devDir2);
      expect(() => fsSync.statSync(devDir1).isDirectory()).not.toThrow();
      expect(fsSync.statSync(devDir1).isDirectory()).toBe(true);
      expect(() => fsSync.statSync(devDir2).isDirectory()).not.toThrow();
      expect(fsSync.statSync(devDir2).isDirectory()).toBe(true);
      // Verify paths are correct
      expect(devDir1).toContain('applications-dev-1');
      expect(devDir2).toContain('applications-dev-2');
    });

    it('should copy files and directories in the same directory', async() => {
      const appName = 'test-app';
      const developerId = 1;
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });
      // Create a directory with both files and subdirectories
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.mkdirSync(path.join(builderPath, 'subdir'), { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'file1.txt'), 'content1', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, 'file2.txt'), 'content2', 'utf8');
      fsSync.writeFileSync(path.join(builderPath, 'subdir', 'file3.txt'), 'content3', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      const dirStats = fsSync.statSync(builderPath);
      expect(dirStats.isDirectory()).toBe(true);

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      // Verify both files and directories were copied
      expect(() => fsSync.statSync(path.join(devDir, 'file1.txt')).isFile()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'file1.txt')).isFile()).toBe(true);
      expect(() => fsSync.statSync(path.join(devDir, 'file2.txt')).isFile()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'file2.txt')).isFile()).toBe(true);
      expect(() => fsSync.statSync(path.join(devDir, 'subdir')).isDirectory()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'subdir')).isDirectory()).toBe(true);
      expect(() => fsSync.statSync(path.join(devDir, 'subdir', 'file3.txt')).isFile()).not.toThrow();
      expect(fsSync.statSync(path.join(devDir, 'subdir', 'file3.txt')).isFile()).toBe(true);

      // Verify file contents
      const content1 = await fs.readFile(path.join(devDir, 'file1.txt'), 'utf8');
      const content2 = await fs.readFile(path.join(devDir, 'file2.txt'), 'utf8');
      const content3 = await fs.readFile(path.join(devDir, 'subdir', 'file3.txt'), 'utf8');
      expect(content1).toBe('content1');
      expect(content2).toBe('content2');
      expect(content3).toBe('content3');
    });
  });

  describe('getDevDirectory', () => {
    it('should return correct developer directory path for dev > 0', () => {
      const appName = 'test-app';
      const developerId = 1;

      const devDir = buildCopy.getDevDirectory(appName, developerId);

      const expectedPath = path.join(tempDir, '.aifabrix', `applications-dev-${developerId}`);
      expect(devDir).toBe(expectedPath);
    });

    it('should return applications/ for developer ID 0', () => {
      const appName = 'test-app';
      const developerId = 0;

      const devDir = buildCopy.getDevDirectory(appName, developerId);

      const expectedPath = path.join(tempDir, '.aifabrix', 'applications');
      expect(devDir).toBe(expectedPath);
    });

    it('should handle different app names and developer IDs', () => {
      const devDir1 = buildCopy.getDevDirectory('app1', 1);
      const devDir2 = buildCopy.getDevDirectory('app2', 2);

      expect(devDir1).toContain('applications-dev-1');
      expect(devDir2).toContain('applications-dev-2');
      expect(devDir1).not.toBe(devDir2);
    });
  });

  describe('devDirectoryExists', () => {
    it('should return false when directory does not exist', () => {
      const appName = 'nonexistent-app';
      const developerId = 999;

      const exists = buildCopy.devDirectoryExists(appName, developerId);

      expect(exists).toBe(false);
    });

    it('should return true when directory exists', async() => {
      const appName = 'test-app';
      const developerId = 1;
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });

      // Create builder directory and copy it
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      const dirStats = fsSync.statSync(builderPath);
      expect(dirStats.isDirectory()).toBe(true);

      await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      const exists = buildCopy.devDirectoryExists(appName, developerId);

      expect(exists).toBe(true);
    });

    it('should return false for different developer IDs', async() => {
      const appName = 'test-app';
      const developerId1 = 1;
      const developerId2 = 2;
      // Use path.resolve with process.cwd() to match getBuilderPath behavior
      const builderPath = path.resolve(process.cwd(), 'builder', appName);
      // Ensure parent directory exists
      const builderParent = path.dirname(builderPath);
      fsSync.mkdirSync(builderParent, { recursive: true });

      // Create builder directory and copy for developer 1
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'variables.yaml'), 'test: value', 'utf8');

      // Verify directory exists before calling copyBuilderToDevDirectory
      // Use statSync for reliable check
      expect(fsSync.existsSync(builderPath)).toBe(true);
      const dirStats = fsSync.statSync(builderPath);
      expect(dirStats.isDirectory()).toBe(true);

      await buildCopy.copyBuilderToDevDirectory(appName, developerId1);

      // Check that dev 1 exists but dev 2 does not
      expect(buildCopy.devDirectoryExists(appName, developerId1)).toBe(true);
      expect(buildCopy.devDirectoryExists(appName, developerId2)).toBe(false);
    });
  });
});

