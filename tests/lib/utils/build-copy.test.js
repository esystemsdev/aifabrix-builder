/**
 * Tests for Build Copy Utilities
 *
 * @fileoverview Comprehensive tests for build-copy module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

const buildCopy = require('../../../lib/utils/build-copy');

describe('Build Copy Utilities', () => {
  let tempDir;
  let originalCwd;
  let originalHomedir;

  beforeEach(() => {
    // Create temporary directory for each test
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-build-copy-test-'));
    originalCwd = process.cwd();
    originalHomedir = os.homedir();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    // Clean up temporary directory
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });

    // Clean up dev directories
    const aifabrixDir = path.join(originalHomedir, '.aifabrix');
    if (fsSync.existsSync(aifabrixDir)) {
      const entries = await fs.readdir(aifabrixDir);
      for (const entry of entries) {
        // Clean up applications/ (dev 0) and applications-dev-{id}/ (dev > 0)
        if (entry === 'applications' || entry.startsWith('applications-dev-')) {
          const entryPath = path.join(aifabrixDir, entry);
          await fs.rm(entryPath, { recursive: true, force: true });
        }
      }
    }
  });

  describe('copyBuilderToDevDirectory', () => {
    it('should copy builder directory to developer-specific directory for dev > 0', async() => {
      const appName = 'test-app';
      const developerId = 1;
      const builderPath = path.join('builder', appName);

      // Create builder directory with files
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'variables.yaml'), 'test: value');
      await fs.writeFile(path.join(builderPath, 'Dockerfile'), 'FROM node:18');

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      expect(devDir).toBeDefined();
      expect(fsSync.existsSync(devDir)).toBe(true);
      // Verify path is correct for dev > 0
      const expectedPath = path.join(os.homedir(), '.aifabrix', `applications-dev-${developerId}`, `${appName}-dev-${developerId}`);
      expect(devDir).toBe(expectedPath);

      // Verify files were copied
      const variablesPath = path.join(devDir, 'variables.yaml');
      const dockerfilePath = path.join(devDir, 'Dockerfile');
      expect(fsSync.existsSync(variablesPath)).toBe(true);
      expect(fsSync.existsSync(dockerfilePath)).toBe(true);

      // Verify file contents
      const variablesContent = await fs.readFile(variablesPath, 'utf8');
      expect(variablesContent).toBe('test: value');
    });

    it('should copy builder directory to applications/ for developer ID 0', async() => {
      const appName = 'test-app';
      const developerId = 0;
      const builderPath = path.join('builder', appName);

      // Create builder directory with files
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'variables.yaml'), 'test: value');
      await fs.writeFile(path.join(builderPath, 'Dockerfile'), 'FROM node:18');

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      expect(devDir).toBeDefined();
      expect(fsSync.existsSync(devDir)).toBe(true);
      // Verify path is correct for dev 0
      const expectedPath = path.join(os.homedir(), '.aifabrix', 'applications');
      expect(devDir).toBe(expectedPath);

      // Verify files were copied directly to applications/
      const variablesPath = path.join(devDir, 'variables.yaml');
      const dockerfilePath = path.join(devDir, 'Dockerfile');
      expect(fsSync.existsSync(variablesPath)).toBe(true);
      expect(fsSync.existsSync(dockerfilePath)).toBe(true);

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
      const builderPath = path.join('builder', appName);

      // Create builder directory with nested structure
      await fs.mkdir(path.join(builderPath, 'config'), { recursive: true });
      await fs.mkdir(path.join(builderPath, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(builderPath, 'variables.yaml'), 'test: value');
      await fs.writeFile(path.join(builderPath, 'config', 'app.yaml'), 'app: config');
      await fs.writeFile(path.join(builderPath, 'scripts', 'start.sh'), '#!/bin/bash');

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      // Verify nested directories were copied
      expect(fsSync.existsSync(path.join(devDir, 'config'))).toBe(true);
      expect(fsSync.existsSync(path.join(devDir, 'scripts'))).toBe(true);
      expect(fsSync.existsSync(path.join(devDir, 'config', 'app.yaml'))).toBe(true);
      expect(fsSync.existsSync(path.join(devDir, 'scripts', 'start.sh'))).toBe(true);
    });

    it('should skip hidden files and directories except .env and .gitignore', async() => {
      const appName = 'test-app';
      const developerId = 1;
      const builderPath = path.join('builder', appName);

      // Create builder directory with various files
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'variables.yaml'), 'test: value');
      await fs.writeFile(path.join(builderPath, '.env'), 'ENV_VAR=value');
      await fs.writeFile(path.join(builderPath, '.gitignore'), 'node_modules/');
      await fs.writeFile(path.join(builderPath, '.hidden-file'), 'should be skipped');
      await fs.writeFile(path.join(builderPath, '.another-hidden'), 'should be skipped');
      await fs.mkdir(path.join(builderPath, '.hidden-dir'), { recursive: true });
      await fs.writeFile(path.join(builderPath, '.hidden-dir', 'file.txt'), 'should be skipped');

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      // Verify .env and .gitignore were copied
      expect(fsSync.existsSync(path.join(devDir, '.env'))).toBe(true);
      expect(fsSync.existsSync(path.join(devDir, '.gitignore'))).toBe(true);

      // Verify hidden files and directories were skipped
      expect(fsSync.existsSync(path.join(devDir, '.hidden-file'))).toBe(false);
      expect(fsSync.existsSync(path.join(devDir, '.another-hidden'))).toBe(false);
      expect(fsSync.existsSync(path.join(devDir, '.hidden-dir'))).toBe(false);
    });

    it('should handle multiple developer IDs', async() => {
      const appName = 'test-app';
      const builderPath = path.join('builder', appName);

      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'variables.yaml'), 'test: value');

      const devDir1 = await buildCopy.copyBuilderToDevDirectory(appName, 1);
      const devDir2 = await buildCopy.copyBuilderToDevDirectory(appName, 2);

      expect(devDir1).not.toBe(devDir2);
      expect(fsSync.existsSync(devDir1)).toBe(true);
      expect(fsSync.existsSync(devDir2)).toBe(true);
      // Verify paths are correct
      expect(devDir1).toContain('applications-dev-1');
      expect(devDir1).toContain(`${appName}-dev-1`);
      expect(devDir2).toContain('applications-dev-2');
      expect(devDir2).toContain(`${appName}-dev-2`);
    });

    it('should copy files and directories in the same directory', async() => {
      const appName = 'test-app';
      const developerId = 1;
      const builderPath = path.join('builder', appName);

      // Create a directory with both files and subdirectories
      await fs.mkdir(builderPath, { recursive: true });
      await fs.mkdir(path.join(builderPath, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(builderPath, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(builderPath, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(builderPath, 'subdir', 'file3.txt'), 'content3');

      const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      // Verify both files and directories were copied
      expect(fsSync.existsSync(path.join(devDir, 'file1.txt'))).toBe(true);
      expect(fsSync.existsSync(path.join(devDir, 'file2.txt'))).toBe(true);
      expect(fsSync.existsSync(path.join(devDir, 'subdir'))).toBe(true);
      expect(fsSync.existsSync(path.join(devDir, 'subdir', 'file3.txt'))).toBe(true);

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

      const expectedPath = path.join(os.homedir(), '.aifabrix', `applications-dev-${developerId}`, `${appName}-dev-${developerId}`);
      expect(devDir).toBe(expectedPath);
    });

    it('should return applications/ for developer ID 0', () => {
      const appName = 'test-app';
      const developerId = 0;

      const devDir = buildCopy.getDevDirectory(appName, developerId);

      const expectedPath = path.join(os.homedir(), '.aifabrix', 'applications');
      expect(devDir).toBe(expectedPath);
    });

    it('should handle different app names and developer IDs', () => {
      const devDir1 = buildCopy.getDevDirectory('app1', 1);
      const devDir2 = buildCopy.getDevDirectory('app2', 2);

      expect(devDir1).toContain('applications-dev-1');
      expect(devDir1).toContain('app1-dev-1');
      expect(devDir2).toContain('applications-dev-2');
      expect(devDir2).toContain('app2-dev-2');
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
      const builderPath = path.join('builder', appName);

      // Create builder directory and copy it
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'variables.yaml'), 'test: value');

      await buildCopy.copyBuilderToDevDirectory(appName, developerId);

      const exists = buildCopy.devDirectoryExists(appName, developerId);

      expect(exists).toBe(true);
    });

    it('should return false for different developer IDs', async() => {
      const appName = 'test-app';
      const developerId1 = 1;
      const developerId2 = 2;
      const builderPath = path.join('builder', appName);

      // Create builder directory and copy for developer 1
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'variables.yaml'), 'test: value');

      await buildCopy.copyBuilderToDevDirectory(appName, developerId1);

      // Check that dev 1 exists but dev 2 does not
      expect(buildCopy.devDirectoryExists(appName, developerId1)).toBe(true);
      expect(buildCopy.devDirectoryExists(appName, developerId2)).toBe(false);
    });
  });
});

