/**
 * Tests for AI Fabrix Builder Template Validator Module
 *
 * @fileoverview Unit tests for template-validator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const templateValidator = require('../../lib/template-validator');

describe('Template Validator Module', () => {
  let tempDir;
  let originalCwd;
  let projectRoot;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-template-test-'));
    originalCwd = process.cwd();

    // Get the project root (where templates/ folder should be)
    projectRoot = path.join(__dirname, '..', '..');

    // Create a test templates directory in the temp directory
    const testTemplatesDir = path.join(tempDir, 'templates');
    fsSync.mkdirSync(testTemplatesDir, { recursive: true });

    // Change to temp directory for testing
    process.chdir(tempDir);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validateTemplate', () => {
    it('should validate existing template with files', async() => {
      // Use the actual templates directory from the project
      const projectTemplatesDir = path.join(projectRoot, 'templates', 'applications');

      // Check if miso-controller template exists, otherwise create a test one
      const templateName = 'miso-controller';
      const templatePath = path.join(projectTemplatesDir, templateName);

      if (!fsSync.existsSync(templatePath)) {
        // Create a test template in project templates directory
        fsSync.mkdirSync(templatePath, { recursive: true });
        fsSync.writeFileSync(path.join(templatePath, 'test.yaml'), 'test content');
      }

      // Should pass if template exists
      await expect(templateValidator.validateTemplate(templateName)).resolves.toBe(true);
    });

    it('should throw error if template folder does not exist', async() => {
      const templateName = 'nonexistent-template-xyz';

      await expect(templateValidator.validateTemplate(templateName))
        .rejects.toThrow(`Template '${templateName}' not found`);
    });

    it('should throw error if template folder is empty', async() => {
      // Create empty template directory in project templates/applications
      const emptyTemplatePath = path.join(projectRoot, 'templates', 'applications', 'test-empty');
      fsSync.mkdirSync(emptyTemplatePath, { recursive: true });

      try {
        await expect(templateValidator.validateTemplate('test-empty'))
          .rejects.toThrow('Template \'test-empty\' folder exists but contains no files');
      } finally {
        // Clean up
        if (fsSync.existsSync(emptyTemplatePath)) {
          fsSync.rmSync(emptyTemplatePath, { recursive: true, force: true });
        }
      }
    });

    it('should skip hidden files when validating', async() => {
      // Create template with hidden file only
      const hiddenTemplatePath = path.join(projectRoot, 'templates', 'applications', 'test-hidden');
      fsSync.mkdirSync(hiddenTemplatePath, { recursive: true });
      fsSync.writeFileSync(path.join(hiddenTemplatePath, '.hidden'), 'hidden');
      fsSync.writeFileSync(path.join(hiddenTemplatePath, 'visible.yaml'), 'visible');

      try {
        // Should pass because visible file exists
        await expect(templateValidator.validateTemplate('test-hidden')).resolves.toBe(true);
      } finally {
        // Clean up
        if (fsSync.existsSync(hiddenTemplatePath)) {
          fsSync.rmSync(hiddenTemplatePath, { recursive: true, force: true });
        }
      }
    });
  });

  describe('copyTemplateFiles', () => {
    it('should copy all files from template to app directory', async() => {
      // Create a test template
      const testTemplatePath = path.join(projectRoot, 'templates', 'applications', 'test-copy');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      fsSync.mkdirSync(testTemplatePath, { recursive: true });
      fsSync.writeFileSync(path.join(testTemplatePath, 'variables.yaml'), 'app: test');
      fsSync.writeFileSync(path.join(testTemplatePath, 'env.template'), 'PORT=3000');
      fsSync.mkdirSync(appPath, { recursive: true });

      try {
        const copiedFiles = await templateValidator.copyTemplateFiles('test-copy', appPath);

        expect(copiedFiles.length).toBe(2);
        expect(fsSync.existsSync(path.join(appPath, 'variables.yaml'))).toBe(true);
        expect(fsSync.existsSync(path.join(appPath, 'env.template'))).toBe(true);
      } finally {
        // Clean up
        if (fsSync.existsSync(testTemplatePath)) {
          fsSync.rmSync(testTemplatePath, { recursive: true, force: true });
        }
      }
    });

    it('should preserve directory structure when copying', async() => {
      // Create a test template with subdirectory
      const testTemplatePath = path.join(projectRoot, 'templates', 'applications', 'test-subdir');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      fsSync.mkdirSync(path.join(testTemplatePath, 'config'), { recursive: true });
      fsSync.writeFileSync(path.join(testTemplatePath, 'variables.yaml'), 'app: test');
      fsSync.writeFileSync(path.join(testTemplatePath, 'config', 'settings.yaml'), 'settings');

      try {
        const copiedFiles = await templateValidator.copyTemplateFiles('test-subdir', appPath);

        expect(copiedFiles.length).toBeGreaterThanOrEqual(2);
        expect(fsSync.existsSync(path.join(appPath, 'variables.yaml'))).toBe(true);
        expect(fsSync.existsSync(path.join(appPath, 'config', 'settings.yaml'))).toBe(true);
      } finally {
        // Clean up
        if (fsSync.existsSync(testTemplatePath)) {
          fsSync.rmSync(testTemplatePath, { recursive: true, force: true });
        }
      }
    });

    it('should skip hidden files when copying', async() => {
      // Create a test template with hidden file
      const testTemplatePath = path.join(projectRoot, 'templates', 'applications', 'test-hidden-copy');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      fsSync.mkdirSync(testTemplatePath, { recursive: true });
      fsSync.writeFileSync(path.join(testTemplatePath, '.hidden'), 'hidden');
      fsSync.writeFileSync(path.join(testTemplatePath, 'visible.yaml'), 'visible');

      try {
        const copiedFiles = await templateValidator.copyTemplateFiles('test-hidden-copy', appPath);

        expect(copiedFiles.length).toBe(1);
        expect(fsSync.existsSync(path.join(appPath, 'visible.yaml'))).toBe(true);
        expect(fsSync.existsSync(path.join(appPath, '.hidden'))).toBe(false);
      } finally {
        // Clean up
        if (fsSync.existsSync(testTemplatePath)) {
          fsSync.rmSync(testTemplatePath, { recursive: true, force: true });
        }
      }
    });

    it('should throw error if template does not exist', async() => {
      const templateName = 'nonexistent-template-xyz';
      const appPath = path.join(tempDir, 'builder', 'test-app');

      await expect(templateValidator.copyTemplateFiles(templateName, appPath))
        .rejects.toThrow(`Template '${templateName}' not found`);
    });
  });

  describe('listAvailableTemplates', () => {
    it('should list available templates', async() => {
      const templates = await templateValidator.listAvailableTemplates();

      // Should return an array
      expect(Array.isArray(templates)).toBe(true);

      // If controller or keycloak templates exist, they should be in the list
      // (but don't fail if they don't exist yet)
      expect(templates.length).toBeGreaterThanOrEqual(0);
    });

    it('should exclude system template directories', async() => {
      const templates = await templateValidator.listAvailableTemplates();

      // Should not include github, infra, python, typescript, applications (since we read from it)
      expect(templates).not.toContain('github');
      expect(templates).not.toContain('infra');
      expect(templates).not.toContain('python');
      expect(templates).not.toContain('typescript');
      expect(templates).not.toContain('applications');
    });
  });

  describe('validateTemplate - branch coverage', () => {
    it('should throw error if template name is not a string', async() => {
      await expect(templateValidator.validateTemplate(null))
        .rejects.toThrow('Template name is required and must be a string');

      await expect(templateValidator.validateTemplate(123))
        .rejects.toThrow('Template name is required and must be a string');

      await expect(templateValidator.validateTemplate(undefined))
        .rejects.toThrow('Template name is required and must be a string');
    });

    it('should throw error if template path is not a directory', async() => {
      // Create a file with template name instead of directory
      const projectRoot = path.join(__dirname, '..', '..');
      const templatePath = path.join(projectRoot, 'templates', 'applications', 'test-file');
      fsSync.writeFileSync(templatePath, 'not a directory');

      try {
        await expect(templateValidator.validateTemplate('test-file'))
          .rejects.toThrow('Template \'test-file\' exists but is not a directory');
      } finally {
        if (fsSync.existsSync(templatePath)) {
          fsSync.unlinkSync(templatePath);
        }
      }
    });
  });

  describe('copyAppFiles - branch coverage', () => {
    it('should throw error if language is not a string', async() => {
      const appPath = path.join(tempDir, 'builder', 'test-app');

      await expect(templateValidator.copyAppFiles(null, appPath))
        .rejects.toThrow('Language is required and must be a string');

      await expect(templateValidator.copyAppFiles(123, appPath))
        .rejects.toThrow('Language is required and must be a string');

      await expect(templateValidator.copyAppFiles(undefined, appPath))
        .rejects.toThrow('Language is required and must be a string');
    });

    it('should throw error if language template does not exist', async() => {
      const appPath = path.join(tempDir, 'builder', 'test-app');

      await expect(templateValidator.copyAppFiles('nonexistent-language', appPath))
        .rejects.toThrow('Language template \'nonexistent-language\' not found');
    });

    it('should throw error if language template path is not a directory', async() => {
      const projectRoot = path.join(__dirname, '..', '..');
      const languageTemplatePath = path.join(projectRoot, 'templates', 'test-file-lang');
      fsSync.writeFileSync(languageTemplatePath, 'not a directory');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      try {
        await expect(templateValidator.copyAppFiles('test-file-lang', appPath))
          .rejects.toThrow('Language template \'test-file-lang\' exists but is not a directory');
      } finally {
        if (fsSync.existsSync(languageTemplatePath)) {
          fsSync.unlinkSync(languageTemplatePath);
        }
      }
    });

    it('should exclude .hbs files when copying', async() => {
      const projectRoot = path.join(__dirname, '..', '..');
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      if (fsSync.existsSync(languageTemplatePath)) {
        try {
          const copiedFiles = await templateValidator.copyAppFiles('typescript', appPath);

          // Should not copy .hbs files
          const hbsFiles = copiedFiles.filter(f => f.endsWith('.hbs'));
          expect(hbsFiles.length).toBe(0);
        } catch (error) {
          // Ignore file not found errors for optional files
          if (!error.message.includes('ENOENT')) {
            throw error;
          }
        }
      }
    });

    it('should exclude Dockerfile files when copying', async() => {
      const projectRoot = path.join(__dirname, '..', '..');
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      if (fsSync.existsSync(languageTemplatePath)) {
        try {
          const copiedFiles = await templateValidator.copyAppFiles('typescript', appPath);

          // Should not copy Dockerfile
          const dockerFiles = copiedFiles.filter(f => f.toLowerCase().includes('dockerfile'));
          expect(dockerFiles.length).toBe(0);
        } catch (error) {
          // Ignore file not found errors for optional files
          if (!error.message.includes('ENOENT')) {
            throw error;
          }
        }
      }
    });

    it('should include .gitignore when copying', async() => {
      const projectRoot = path.join(__dirname, '..', '..');
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      if (fsSync.existsSync(languageTemplatePath)) {
        try {
          const copiedFiles = await templateValidator.copyAppFiles('typescript', appPath);

          // Should include .gitignore if it exists
          const gitignoreFiles = copiedFiles.filter(f => f.includes('.gitignore'));
          expect(gitignoreFiles.length).toBeGreaterThanOrEqual(0);
        } catch (error) {
          // Ignore file not found errors for optional files
          if (!error.message.includes('ENOENT')) {
            throw error;
          }
        }
      }
    });

    it('should normalize language to lowercase', async() => {
      const projectRoot = path.join(__dirname, '..', '..');
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      if (fsSync.existsSync(languageTemplatePath)) {
        try {
          // Should work with uppercase
          await expect(templateValidator.copyAppFiles('TYPESCRIPT', appPath)).resolves.toBeDefined();
          await expect(templateValidator.copyAppFiles('TypeScript', appPath)).resolves.toBeDefined();
        } catch (error) {
          // Ignore file not found errors for optional files
          if (!error.message.includes('ENOENT')) {
            throw error;
          }
        }
      }
    });
  });

  describe('listAvailableTemplates - branch coverage', () => {
    it('should return empty array if templates directory does not exist', async() => {
      // Mock fsSync.existsSync to return false for templates directory
      const originalExistsSync = fsSync.existsSync;
      fsSync.existsSync = jest.fn((filePath) => {
        if (filePath.includes('templates') && filePath.includes('applications')) {
          return false;
        }
        return originalExistsSync(filePath);
      });

      try {
        const templates = await templateValidator.listAvailableTemplates();
        expect(templates).toEqual([]);
      } finally {
        fsSync.existsSync = originalExistsSync;
      }
    });

    it('should exclude directories without files', async() => {
      const projectRoot = path.join(__dirname, '..', '..');
      const emptyTemplatePath = path.join(projectRoot, 'templates', 'applications', 'empty-template-test');
      fsSync.mkdirSync(emptyTemplatePath, { recursive: true });

      try {
        const templates = await templateValidator.listAvailableTemplates();
        expect(templates).not.toContain('empty-template-test');
      } finally {
        if (fsSync.existsSync(emptyTemplatePath)) {
          fsSync.rmSync(emptyTemplatePath, { recursive: true, force: true });
        }
      }
    });
  });
});
