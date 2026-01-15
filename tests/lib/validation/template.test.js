/**
 * Tests for Template Validation Module
 *
 * @fileoverview Unit tests for lib/validation/template.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    statSync: jest.fn(),
    promises: {
      readdir: jest.fn(),
      stat: jest.fn(),
      mkdir: jest.fn(),
      copyFile: jest.fn()
    }
  };
});

jest.mock('../../../lib/utils/paths', () => ({
  getProjectRoot: jest.fn()
}));

const { getProjectRoot } = require('../../../lib/utils/paths');
const {
  validateTemplate,
  copyTemplateFiles,
  copyAppFiles,
  listAvailableTemplates
} = require('../../../lib/validation/template');

describe('Template Validation Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTemplate', () => {
    it('should validate template successfully', async() => {
      const templateName = 'basic';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);
      const file1Path = path.join(templatePath, 'file1.txt');
      const file2Path = path.join(templatePath, 'file2.txt');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === templatePath) {
          return { isDirectory: () => true };
        }
        if (filePath === file1Path || filePath === file2Path) {
          return { isFile: () => true };
        }
        return { isFile: () => false, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);

      const result = await validateTemplate(templateName);

      expect(getProjectRoot).toHaveBeenCalled();
      expect(fsSync.existsSync).toHaveBeenCalledWith(templatePath);
      expect(fsSync.statSync).toHaveBeenCalledWith(templatePath);
      expect(fs.readdir).toHaveBeenCalledWith(templatePath);
      expect(result).toBe(true);
    });

    it('should throw error when template name is not provided', async() => {
      await expect(validateTemplate(null)).rejects.toThrow('Template name is required and must be a string');
      await expect(validateTemplate(undefined)).rejects.toThrow('Template name is required and must be a string');
      await expect(validateTemplate('')).rejects.toThrow('Template name is required and must be a string');
    });

    it('should throw error when template name is not a string', async() => {
      await expect(validateTemplate(123)).rejects.toThrow('Template name is required and must be a string');
      await expect(validateTemplate({})).rejects.toThrow('Template name is required and must be a string');
    });

    it('should throw error when template folder does not exist', async() => {
      const templateName = 'nonexistent';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(false);

      await expect(validateTemplate(templateName)).rejects.toThrow(
        `Template '${templateName}' not found. Expected folder: templates/applications/${templateName}/`
      );
    });

    it('should throw error when template path is not a directory', async() => {
      const templateName = 'basic';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockReturnValue({ isDirectory: () => false });

      await expect(validateTemplate(templateName)).rejects.toThrow(
        `Template '${templateName}' exists but is not a directory`
      );
    });

    it('should throw error when template folder contains no files', async() => {
      const templateName = 'empty';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockReturnValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue([]);

      await expect(validateTemplate(templateName)).rejects.toThrow(
        `Template '${templateName}' folder exists but contains no files`
      );
    });

    it('should skip hidden files when counting files', async() => {
      const templateName = 'basic';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);
      const file1Path = path.join(templatePath, 'file1.txt');
      const hiddenPath = path.join(templatePath, '.hidden');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === templatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (filePath === file1Path) {
          return { isFile: () => true, isDirectory: () => false };
        }
        if (filePath === hiddenPath) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['.hidden', 'file1.txt']);

      const result = await validateTemplate(templateName);

      expect(result).toBe(true);
      // Verify that .hidden was checked but not counted (since it starts with .)
      expect(fsSync.statSync).toHaveBeenCalledWith(hiddenPath);
    });

    it('should skip directories when counting files', async() => {
      const templateName = 'basic';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);
      const file1Path = path.join(templatePath, 'file1.txt');
      const subdirPath = path.join(templatePath, 'subdir');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === templatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (filePath === file1Path) {
          return { isFile: () => true, isDirectory: () => false };
        }
        if (filePath === subdirPath) {
          return { isFile: () => false, isDirectory: () => true };
        }
        return { isFile: () => false, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['subdir', 'file1.txt']);

      const result = await validateTemplate(templateName);

      expect(result).toBe(true);
      // Verify that subdir was checked but not counted (since it's a directory)
      expect(fsSync.statSync).toHaveBeenCalledWith(subdirPath);
    });
  });

  describe('copyTemplateFiles', () => {
    it('should copy template files successfully', async() => {
      const templateName = 'basic';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === templatePath) {
          return { isDirectory: () => true };
        }
        // For validateTemplate - check individual files
        const fileName = path.basename(filePath);
        if (fileName === 'file1.txt' || fileName === 'file2.txt') {
          return { isFile: () => true };
        }
        return { isFile: () => false, isDirectory: () => false };
      });
      fs.readdir
        .mockResolvedValueOnce(['file1.txt', 'file2.txt']) // validateTemplate
        .mockResolvedValueOnce(['file1.txt', 'file2.txt']); // copyDirectory
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyTemplateFiles(templateName, appPath);

      expect(result).toHaveLength(2);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.copyFile).toHaveBeenCalledTimes(2);
    });

    it('should copy files recursively from subdirectories', async() => {
      const templateName = 'basic';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);
      const subdirPath = path.join(templatePath, 'subdir');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      const file1Path = path.join(templatePath, 'file1.txt');
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === templatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (filePath === file1Path) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });
      fs.readdir
        .mockResolvedValueOnce(['file1.txt']) // validateTemplate
        .mockResolvedValueOnce(['subdir', 'file1.txt']) // copyDirectory root
        .mockResolvedValueOnce(['file2.txt']); // copyDirectory subdir
      fs.stat
        .mockResolvedValueOnce({ isFile: () => false, isDirectory: () => true }) // subdir
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false }) // file1.txt
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false }); // file2.txt
      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyTemplateFiles(templateName, appPath);

      expect(result.length).toBeGreaterThan(0);
      expect(fs.mkdir).toHaveBeenCalledTimes(2); // appPath and subdir
    });

    it('should skip hidden files when copying', async() => {
      const templateName = 'basic';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      const file1Path = path.join(templatePath, 'file1.txt');
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === templatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (filePath === file1Path) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });
      fs.readdir
        .mockResolvedValueOnce(['.hidden', 'file1.txt']) // validateTemplate
        .mockResolvedValueOnce(['.hidden', 'file1.txt']); // copyDirectory
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyTemplateFiles(templateName, appPath);

      expect(result).toHaveLength(1); // Only file1.txt, not .hidden
      expect(fs.copyFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error if template validation fails', async() => {
      const templateName = 'nonexistent';
      const appPath = '/app/path';
      const projectRoot = '/project/root';

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(false);

      await expect(copyTemplateFiles(templateName, appPath)).rejects.toThrow(
        `Template '${templateName}' not found`
      );
    });

    it('should create target directory if it does not exist', async() => {
      const templateName = 'basic';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const templatePath = path.join(projectRoot, 'templates', 'applications', templateName);

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      const file1Path = path.join(templatePath, 'file1.txt');
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === templatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (filePath === file1Path) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });
      fs.readdir
        .mockResolvedValueOnce(['file1.txt']) // validateTemplate
        .mockResolvedValueOnce(['file1.txt']); // copyDirectory
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockResolvedValue(undefined);

      await copyTemplateFiles(templateName, appPath);

      expect(fs.mkdir).toHaveBeenCalledWith(appPath, { recursive: true });
    });
  });

  describe('copyAppFiles', () => {
    it('should copy app files successfully', async() => {
      const language = 'typescript';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === languageTemplatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isFile: () => true, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['package.json', 'index.ts']);
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyAppFiles(language, appPath);

      expect(result).toHaveLength(2);
      expect(fs.copyFile).toHaveBeenCalledTimes(2);
    });

    it('should normalize language to lowercase', async() => {
      const language = 'TypeScript';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === languageTemplatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isFile: () => true, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['package.json']);
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.copyFile.mockResolvedValue(undefined);

      await copyAppFiles(language, appPath);

      expect(fsSync.existsSync).toHaveBeenCalledWith(languageTemplatePath);
    });

    it('should throw error when language is not provided', async() => {
      await expect(copyAppFiles(null, '/app/path')).rejects.toThrow('Language is required and must be a string');
      await expect(copyAppFiles(undefined, '/app/path')).rejects.toThrow('Language is required and must be a string');
      await expect(copyAppFiles('', '/app/path')).rejects.toThrow('Language is required and must be a string');
    });

    it('should throw error when language template does not exist', async() => {
      const language = 'nonexistent';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const languageTemplatePath = path.join(projectRoot, 'templates', 'nonexistent');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(false);

      await expect(copyAppFiles(language, appPath)).rejects.toThrow(
        `Language template '${language}' not found. Expected folder: templates/${language}/`
      );
    });

    it('should filter out .hbs files', async() => {
      const language = 'typescript';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === languageTemplatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isFile: () => true, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['package.json', 'template.hbs', 'index.ts']);
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyAppFiles(language, appPath);

      expect(result).toHaveLength(2); // package.json and index.ts, not template.hbs
    });

    it('should filter out dockerfile files', async() => {
      const language = 'typescript';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === languageTemplatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isFile: () => true, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['package.json', 'Dockerfile', 'docker-compose.yml']);
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyAppFiles(language, appPath);

      expect(result).toHaveLength(1); // Only package.json
    });

    it('should include .gitignore file', async() => {
      const language = 'typescript';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === languageTemplatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isFile: () => true, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['package.json', '.gitignore']);
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyAppFiles(language, appPath);

      expect(result).toHaveLength(2); // Both package.json and .gitignore
    });

    it('should filter out hidden files except .gitignore', async() => {
      const language = 'typescript';
      const appPath = '/app/path';
      const projectRoot = '/project/root';
      const languageTemplatePath = path.join(projectRoot, 'templates', 'typescript');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fsSync.statSync.mockImplementation((filePath) => {
        if (filePath === languageTemplatePath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isFile: () => true, isDirectory: () => false };
      });
      fs.readdir.mockResolvedValue(['package.json', '.hidden', '.gitignore']);
      fs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
      fs.copyFile.mockResolvedValue(undefined);

      const result = await copyAppFiles(language, appPath);

      expect(result).toHaveLength(2); // package.json and .gitignore, not .hidden
    });
  });

  describe('listAvailableTemplates', () => {
    it('should list available templates', async() => {
      const projectRoot = '/project/root';
      const templatesDir = path.join(projectRoot, 'templates', 'applications');
      const basicPath = path.join(templatesDir, 'basic');
      const advancedPath = path.join(templatesDir, 'advanced');
      const emptyPath = path.join(templatesDir, 'empty');
      const basicFile = path.join(basicPath, 'file1.txt');
      const advancedFile = path.join(advancedPath, 'file1.txt');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockImplementation((entryPath) => {
        if (entryPath === templatesDir) {
          return Promise.resolve(['basic', 'advanced', 'empty']);
        }
        if (entryPath === emptyPath) {
          return Promise.resolve([]);
        }
        return Promise.resolve(['file1.txt']);
      });
      fsSync.statSync.mockImplementation((entryPath) => {
        if (entryPath === basicPath || entryPath === advancedPath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (entryPath === emptyPath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (entryPath === basicFile || entryPath === advancedFile) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });

      const result = await listAvailableTemplates();

      expect(result).toEqual(['advanced', 'basic']); // Sorted, excludes empty
    });

    it('should return empty array when templates directory does not exist', async() => {
      const projectRoot = '/project/root';
      const templatesDir = path.join(projectRoot, 'templates', 'applications');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(false);

      const result = await listAvailableTemplates();

      expect(result).toEqual([]);
    });

    it('should skip non-directory entries', async() => {
      const projectRoot = '/project/root';
      const templatesDir = path.join(projectRoot, 'templates', 'applications');
      const basicPath = path.join(templatesDir, 'basic');
      const fileTxtPath = path.join(templatesDir, 'file.txt');
      const basicFile = path.join(basicPath, 'file1.txt');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockImplementation((entryPath) => {
        if (entryPath === templatesDir) {
          return Promise.resolve(['basic', 'file.txt']);
        }
        if (entryPath === basicPath) {
          return Promise.resolve(['file1.txt']);
        }
        return Promise.resolve([]);
      });
      fsSync.statSync.mockImplementation((entryPath) => {
        if (entryPath === basicPath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (entryPath === fileTxtPath) {
          return { isDirectory: () => false, isFile: () => true };
        }
        if (entryPath === basicFile) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });

      const result = await listAvailableTemplates();

      expect(result).toEqual(['basic']); // Only directory, not file.txt
    });

    it('should skip directories with no files', async() => {
      const projectRoot = '/project/root';
      const templatesDir = path.join(projectRoot, 'templates', 'applications');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      const basicPath = path.join(templatesDir, 'basic');
      const emptyPath = path.join(templatesDir, 'empty');
      const basicFile = path.join(basicPath, 'file1.txt');
      const hiddenFile = path.join(emptyPath, '.hidden');

      fs.readdir.mockImplementation((entryPath) => {
        if (entryPath === templatesDir) {
          return Promise.resolve(['basic', 'empty']);
        }
        if (entryPath === emptyPath) {
          return Promise.resolve(['.hidden']);
        }
        if (entryPath === basicPath) {
          return Promise.resolve(['file1.txt']);
        }
        return Promise.resolve([]);
      });
      fsSync.statSync.mockImplementation((entryPath) => {
        if (entryPath === basicPath || entryPath === emptyPath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (entryPath === basicFile) {
          return { isFile: () => true, isDirectory: () => false };
        }
        if (entryPath === hiddenFile) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });

      const result = await listAvailableTemplates();

      expect(result).toEqual(['basic']); // Only basic, not empty
    });

    it('should return sorted template names', async() => {
      const projectRoot = '/project/root';
      const templatesDir = path.join(projectRoot, 'templates', 'applications');

      const alphaPath = path.join(templatesDir, 'alpha');
      const betaPath = path.join(templatesDir, 'beta');
      const zebraPath = path.join(templatesDir, 'zebra');
      const alphaFile = path.join(alphaPath, 'file1.txt');
      const betaFile = path.join(betaPath, 'file1.txt');
      const zebraFile = path.join(zebraPath, 'file1.txt');

      getProjectRoot.mockReturnValue(projectRoot);
      fsSync.existsSync.mockReturnValue(true);
      fs.readdir.mockImplementation((entryPath) => {
        if (entryPath === templatesDir) {
          return Promise.resolve(['zebra', 'alpha', 'beta']);
        }
        return Promise.resolve(['file1.txt']);
      });
      fsSync.statSync.mockImplementation((entryPath) => {
        if (entryPath === alphaPath || entryPath === betaPath || entryPath === zebraPath) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (entryPath === alphaFile || entryPath === betaFile || entryPath === zebraFile) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return { isFile: () => false, isDirectory: () => false };
      });

      const result = await listAvailableTemplates();

      expect(result).toEqual(['alpha', 'beta', 'zebra']); // Sorted alphabetically
    });
  });
});

