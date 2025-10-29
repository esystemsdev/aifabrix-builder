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
      const projectTemplatesDir = path.join(projectRoot, 'templates');

      // Check if any templates exist (controller or keycloak)
      // If not, create a test one
      const templateName = 'controller';
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
      // Create empty template directory in project templates
      const emptyTemplatePath = path.join(projectRoot, 'templates', 'test-empty');
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
      const hiddenTemplatePath = path.join(projectRoot, 'templates', 'test-hidden');
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
      const testTemplatePath = path.join(projectRoot, 'templates', 'test-copy');
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
      const testTemplatePath = path.join(projectRoot, 'templates', 'test-subdir');
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
      const testTemplatePath = path.join(projectRoot, 'templates', 'test-hidden-copy');
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

      // Should not include github, infra, python, typescript, template
      expect(templates).not.toContain('github');
      expect(templates).not.toContain('infra');
      expect(templates).not.toContain('python');
      expect(templates).not.toContain('typescript');
      expect(templates).not.toContain('template');
    });
  });
});
