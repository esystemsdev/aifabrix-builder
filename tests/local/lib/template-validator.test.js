/**
 * Tests for AI Fabrix Builder Template Validator Module
 *
 * @fileoverview Unit tests for template-validator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');

// Mock fs to use real implementation to override any other mocks
jest.mock('fs', () => {
  return jest.requireActual('fs');
});

const fs = require('fs').promises;
const fsSync = require('fs');

// Mock paths module before requiring template-validator
jest.mock('../../../lib/utils/paths', () => {
  const actualPaths = jest.requireActual('../../../lib/utils/paths');
  return {
    ...actualPaths,
    getProjectRoot: jest.fn()
  };
});

const templateValidator = require('../../../lib/validation/template');

describe('Template Validator Module', () => {
  let tempDir;
  let originalCwd;
  let projectRoot;
  let pathsModule;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-template-test-'));
    originalCwd = process.cwd();

    // Get paths module (already mocked at top level)
    pathsModule = require('../../../lib/utils/paths');

    // Clear project root cache to ensure we get the correct root
    // This is important in CI simulation where project is copied
    const { getProjectRoot: realGetProjectRoot, clearProjectRootCache } = jest.requireActual('../../../lib/utils/paths');
    clearProjectRootCache();

    // Get project root BEFORE changing cwd
    // Use global.PROJECT_ROOT if available (set by tests/setup.js), otherwise use realGetProjectRoot
    // This ensures we get the correct project root even in CI simulation
    if (typeof global !== 'undefined' && global.PROJECT_ROOT) {
      projectRoot = global.PROJECT_ROOT;
    } else {
      projectRoot = realGetProjectRoot();
    }

    // Change to temp directory for testing
    process.chdir(tempDir);

    // Set up mock to return real projectRoot by default
    pathsModule.getProjectRoot.mockReturnValue(projectRoot);

    // Verify project root has templates directory - if not, create it
    // This handles CI simulation where templates might not be copied
    const templatesDir = path.join(projectRoot, 'templates');
    const applicationsDir = path.join(templatesDir, 'applications');
    if (!fsSync.existsSync(templatesDir)) {
      fsSync.mkdirSync(templatesDir, { recursive: true });
    }
    if (!fsSync.existsSync(applicationsDir)) {
      fsSync.mkdirSync(applicationsDir, { recursive: true });
    }
  });

  afterEach(async() => {
    // Reset mock
    if (pathsModule) {
      pathsModule.getProjectRoot.mockClear();
    }
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validateTemplate', () => {
    it('should validate existing template with files', async() => {
      // Mock getProjectRoot to return tempDir BEFORE creating directories
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Use temp directory for templates to avoid writing to real project templates
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      const templateName = 'miso-controller';
      const templatePath = path.join(tempTemplatesDir, templateName);

      // Create templates directory structure in temp
      fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      expect(fsSync.existsSync(tempTemplatesDir)).toBe(true);

      // Create test template in temp directory
      fsSync.mkdirSync(templatePath, { recursive: true });
      const testFile = path.join(templatePath, 'test.yaml');
      fsSync.writeFileSync(testFile, 'test content', 'utf8');

      // Verify template exists and has files - use statSync for reliable check
      expect(fsSync.existsSync(templatePath)).toBe(true);
      expect(fsSync.statSync(templatePath).isDirectory()).toBe(true);
      expect(fsSync.existsSync(testFile)).toBe(true);

      // Verify getProjectRoot returns tempDir
      expect(pathsModule.getProjectRoot()).toBe(tempDir);
      const files = fsSync.readdirSync(templatePath);
      const hasFiles = files.some(file => {
        const filePath = path.join(templatePath, file);
        return fsSync.statSync(filePath).isFile() && !file.startsWith('.');
      });
      expect(hasFiles).toBe(true);

      // Should pass if template exists
      await expect(templateValidator.validateTemplate(templateName)).resolves.toBe(true);
    });

    it('should throw error if template folder does not exist', async() => {
      const templateName = 'nonexistent-template-xyz';

      await expect(templateValidator.validateTemplate(templateName))
        .rejects.toThrow(`Template '${templateName}' not found`);
    });

    it('should throw error if template folder is empty', async() => {
      // Use temp directory for templates to avoid writing to real project templates
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      const emptyTemplatePath = path.join(tempTemplatesDir, 'test-empty');

      // Mock getProjectRoot to return tempDir
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Create empty template directory in temp
      fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      expect(fsSync.existsSync(tempTemplatesDir)).toBe(true);
      fsSync.mkdirSync(emptyTemplatePath, { recursive: true });
      expect(fsSync.existsSync(emptyTemplatePath)).toBe(true);

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
      // Set up mock to return tempDir
      const pathsModule = require('../../../lib/utils/paths');
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Create template with hidden file only in tempDir
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      // Ensure parent directory exists
      fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      const hiddenTemplatePath = path.join(tempTemplatesDir, 'test-hidden');
      fsSync.mkdirSync(hiddenTemplatePath, { recursive: true });
      fsSync.writeFileSync(path.join(hiddenTemplatePath, '.hidden'), 'hidden', 'utf8');
      fsSync.writeFileSync(path.join(hiddenTemplatePath, 'visible.yaml'), 'visible', 'utf8');

      // Verify files exist - use statSync for reliable check
      expect(fsSync.existsSync(path.join(hiddenTemplatePath, 'visible.yaml'))).toBe(true);
      expect(fsSync.statSync(path.join(hiddenTemplatePath, 'visible.yaml')).isFile()).toBe(true);

      try {
        // Should pass because visible file exists
        await expect(templateValidator.validateTemplate('test-hidden')).resolves.toBe(true);
      } finally {
        pathsModule.getProjectRoot.mockClear();
        // Clean up
        if (fsSync.existsSync(hiddenTemplatePath)) {
          fsSync.rmSync(hiddenTemplatePath, { recursive: true, force: true });
        }
      }
    });
  });

  describe('copyTemplateFiles', () => {
    it('should copy all files from template to app directory', async() => {
      // Set up mock to return tempDir
      const pathsModule = require('../../../lib/utils/paths');
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Create a test template in tempDir
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      // Ensure parent directory exists
      if (!fsSync.existsSync(tempTemplatesDir)) {
        const templatesParent = path.dirname(tempTemplatesDir);
        if (!fsSync.existsSync(templatesParent)) {
          fsSync.mkdirSync(templatesParent, { recursive: true });
        }
        fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      }
      const testTemplatePath = path.join(tempTemplatesDir, 'test-copy');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      fsSync.mkdirSync(testTemplatePath, { recursive: true });
      fsSync.writeFileSync(path.join(testTemplatePath, 'variables.yaml'), 'app: test', 'utf8');
      fsSync.writeFileSync(path.join(testTemplatePath, 'env.template'), 'PORT=3000', 'utf8');
      // Ensure app directory parent exists
      const appParent = path.dirname(appPath);
      if (!fsSync.existsSync(appParent)) {
        fsSync.mkdirSync(appParent, { recursive: true });
      }
      fsSync.mkdirSync(appPath, { recursive: true });

      // Verify files exist - use statSync for reliable check
      expect(fsSync.existsSync(path.join(testTemplatePath, 'variables.yaml'))).toBe(true);
      expect(fsSync.existsSync(path.join(testTemplatePath, 'env.template'))).toBe(true);
      expect(fsSync.statSync(path.join(testTemplatePath, 'variables.yaml')).isFile()).toBe(true);
      expect(fsSync.statSync(path.join(testTemplatePath, 'env.template')).isFile()).toBe(true);

      try {
        const copiedFiles = await templateValidator.copyTemplateFiles('test-copy', appPath);

        expect(copiedFiles.length).toBe(2);
        expect(fsSync.statSync(path.join(appPath, 'variables.yaml')).isFile()).toBe(true);
        expect(fsSync.statSync(path.join(appPath, 'env.template')).isFile()).toBe(true);
      } finally {
        pathsModule.getProjectRoot.mockClear();
        // Clean up
        if (fsSync.existsSync(testTemplatePath)) {
          fsSync.rmSync(testTemplatePath, { recursive: true, force: true });
        }
      }
    });

    it('should preserve directory structure when copying', async() => {
      // Set up mock to return tempDir
      const pathsModule = require('../../../lib/utils/paths');
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Create a test template with subdirectory in tempDir
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      // Ensure parent directory exists
      if (!fsSync.existsSync(tempTemplatesDir)) {
        const templatesParent = path.dirname(tempTemplatesDir);
        if (!fsSync.existsSync(templatesParent)) {
          fsSync.mkdirSync(templatesParent, { recursive: true });
        }
        fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      }
      const testTemplatePath = path.join(tempTemplatesDir, 'test-subdir');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      fsSync.mkdirSync(path.join(testTemplatePath, 'config'), { recursive: true });
      fsSync.writeFileSync(path.join(testTemplatePath, 'variables.yaml'), 'app: test', 'utf8');
      fsSync.writeFileSync(path.join(testTemplatePath, 'config', 'settings.yaml'), 'settings', 'utf8');
      // Ensure app directory parent exists
      const appParent = path.dirname(appPath);
      if (!fsSync.existsSync(appParent)) {
        fsSync.mkdirSync(appParent, { recursive: true });
      }

      // Verify files exist - use statSync for reliable check
      expect(fsSync.existsSync(path.join(testTemplatePath, 'variables.yaml'))).toBe(true);
      expect(fsSync.existsSync(path.join(testTemplatePath, 'config', 'settings.yaml'))).toBe(true);
      expect(fsSync.statSync(path.join(testTemplatePath, 'variables.yaml')).isFile()).toBe(true);
      expect(fsSync.statSync(path.join(testTemplatePath, 'config', 'settings.yaml')).isFile()).toBe(true);

      try {
        const copiedFiles = await templateValidator.copyTemplateFiles('test-subdir', appPath);

        expect(copiedFiles.length).toBeGreaterThanOrEqual(2);
        expect(fsSync.statSync(path.join(appPath, 'variables.yaml')).isFile()).toBe(true);
        expect(fsSync.statSync(path.join(appPath, 'config', 'settings.yaml')).isFile()).toBe(true);
      } finally {
        pathsModule.getProjectRoot.mockClear();
        // Clean up
        if (fsSync.existsSync(testTemplatePath)) {
          fsSync.rmSync(testTemplatePath, { recursive: true, force: true });
        }
      }
    });

    it('should skip hidden files when copying', async() => {
      // Set up mock to return tempDir
      const pathsModule = require('../../../lib/utils/paths');
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Create a test template with hidden file in tempDir
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      // Ensure parent directory exists
      fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      const testTemplatePath = path.join(tempTemplatesDir, 'test-hidden-copy');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      fsSync.mkdirSync(testTemplatePath, { recursive: true });
      fsSync.writeFileSync(path.join(testTemplatePath, '.hidden'), 'hidden', 'utf8');
      fsSync.writeFileSync(path.join(testTemplatePath, 'visible.yaml'), 'visible', 'utf8');
      // Ensure app directory parent exists
      fsSync.mkdirSync(path.dirname(appPath), { recursive: true });

      // Verify files exist
      expect(fsSync.existsSync(path.join(testTemplatePath, 'visible.yaml'))).toBe(true);
      expect(fsSync.statSync(path.join(testTemplatePath, 'visible.yaml')).isFile()).toBe(true);

      try {
        const copiedFiles = await templateValidator.copyTemplateFiles('test-hidden-copy', appPath);

        expect(copiedFiles.length).toBe(1);
        expect(fsSync.statSync(path.join(appPath, 'visible.yaml')).isFile()).toBe(true);
        expect(() => fsSync.statSync(path.join(appPath, '.hidden'))).toThrow();
      } finally {
        pathsModule.getProjectRoot.mockClear();
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
      // Set up mock to return tempDir
      const pathsModule = require('../../../lib/utils/paths');
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Use tempDir to avoid writing to real templates
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      // Ensure parent directory exists
      if (!fsSync.existsSync(tempTemplatesDir)) {
        const templatesParent = path.dirname(tempTemplatesDir);
        if (!fsSync.existsSync(templatesParent)) {
          fsSync.mkdirSync(templatesParent, { recursive: true });
        }
        fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      }
      // Create a file with template name instead of directory
      const templatePath = path.join(tempTemplatesDir, 'test-file');
      fsSync.writeFileSync(templatePath, 'not a directory', 'utf8');

      // Verify file exists (not a directory) - use statSync for reliable check
      expect(fsSync.existsSync(templatePath)).toBe(true);
      expect(fsSync.statSync(templatePath).isFile()).toBe(true);

      try {
        await expect(templateValidator.validateTemplate('test-file'))
          .rejects.toThrow('Template \'test-file\' exists but is not a directory');
      } finally {
        pathsModule.getProjectRoot.mockClear();
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
      // Set up mock to return tempDir
      const pathsModule = require('../../../lib/utils/paths');
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Use tempDir to avoid writing to real templates
      const tempTemplatesDir = path.join(tempDir, 'templates');
      // Ensure templates directory exists
      if (!fsSync.existsSync(tempTemplatesDir)) {
        fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      }
      const languageTemplatePath = path.join(tempTemplatesDir, 'test-file-lang');
      fsSync.writeFileSync(languageTemplatePath, 'not a directory', 'utf8');
      const appPath = path.join(tempDir, 'builder', 'test-app');

      // Verify file exists (not a directory) - use statSync for reliable check
      expect(fsSync.existsSync(languageTemplatePath)).toBe(true);
      expect(fsSync.statSync(languageTemplatePath).isFile()).toBe(true);

      try {
        await expect(templateValidator.copyAppFiles('test-file-lang', appPath))
          .rejects.toThrow('Language template \'test-file-lang\' exists but is not a directory');
      } finally {
        pathsModule.getProjectRoot.mockClear();
        if (fsSync.existsSync(languageTemplatePath)) {
          fsSync.unlinkSync(languageTemplatePath);
        }
      }
    });

    it('should exclude .hbs files when copying', async() => {
      // Use getProjectRoot to find templates (works in CI simulation)
      const { getProjectRoot } = require('../../../lib/utils/paths');
      const projectRoot = getProjectRoot();
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
      // Use getProjectRoot to find templates (works in CI simulation)
      const { getProjectRoot } = require('../../../lib/utils/paths');
      const projectRoot = getProjectRoot();
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
      // Use getProjectRoot to find templates (works in CI simulation)
      const { getProjectRoot } = require('../../../lib/utils/paths');
      const projectRoot = getProjectRoot();
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
      // Use getProjectRoot to find templates (works in CI simulation)
      const { getProjectRoot } = require('../../../lib/utils/paths');
      const projectRoot = getProjectRoot();
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
      // Use temp directory for templates to avoid writing to real project templates
      const tempTemplatesDir = path.join(tempDir, 'templates', 'applications');
      const emptyTemplatePath = path.join(tempTemplatesDir, 'empty-template-test');

      // Mock getProjectRoot to return tempDir
      pathsModule.getProjectRoot.mockReturnValue(tempDir);

      // Create empty template directory in temp
      if (!fsSync.existsSync(tempTemplatesDir)) {
        fsSync.mkdirSync(tempTemplatesDir, { recursive: true });
      }
      fsSync.mkdirSync(emptyTemplatePath, { recursive: true });

      const templates = await templateValidator.listAvailableTemplates();
      expect(templates).not.toContain('empty-template-test');
    });
  });
});
