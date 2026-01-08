/**
 * Tests for build .env generation environment
 */

jest.mock('../../lib/secrets', () => ({
  generateEnvFile: jest.fn().mockResolvedValue('/tmp/.env')
}));

const secretsModule = require('../../lib/secrets');
const buildModule = require('../../lib/build');

describe('Build .env generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses docker environment when generating .env in postBuildTasks', async() => {
    const buildConfig = { secrets: '/path/to/secrets.yaml' };
    await buildModule.postBuildTasks('myapp', buildConfig);
    expect(secretsModule.generateEnvFile).toHaveBeenCalledWith('myapp', '/path/to/secrets.yaml', 'docker');
  });
});

/**
 * Tests for AI Fabrix Builder Build Module
 *
 * @fileoverview Unit tests for build.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const build = require('../../lib/build');
const configModule = require('../../lib/config');
const validator = require('../../lib/validator');
const secrets = require('../../lib/secrets');
const dockerBuild = require('../../lib/utils/docker-build');

// Mock inquirer to avoid interactive prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock docker-build module to prevent actual Docker commands
jest.mock('../../lib/utils/docker-build', () => ({
  executeDockerBuild: jest.fn().mockResolvedValue(),
  executeDockerBuildWithTag: jest.fn().mockResolvedValue(),
  isDockerNotAvailableError: jest.fn()
}));

// Mock paths module to allow getProjectRoot to be mocked per test
// But use actual implementation by default so beforeEach can get realProjectRoot
jest.mock('../../lib/utils/paths', () => {
  const actualPaths = jest.requireActual('../../lib/utils/paths');
  const mockGetProjectRoot = jest.fn();
  // Set default implementation to actual function so it works in beforeEach
  mockGetProjectRoot.mockImplementation(actualPaths.getProjectRoot);
  return {
    ...actualPaths,
    getProjectRoot: mockGetProjectRoot
  };
});

// Mock util.promisify for exec calls (still used for tagging)
// Create mock function directly in factory to avoid hoisting issues
jest.mock('util', () => {
  const mockFn = jest.fn().mockResolvedValue({
    stdout: 'Tag successful',
    stderr: ''
  });
  return {
    promisify: jest.fn(() => mockFn)
  };
});

// Get the mock function after module is loaded
let mockRunFunction;

describe('Build Module', () => {
  // Set test timeout to prevent infinite hangs
  jest.setTimeout(30000); // 30 seconds

  let tempDir;
  let originalCwd;
  let realProjectRoot;
  let pathsModule;
  let getProjectRootSpy;
  let writeFileSyncSpy;
  let writeFileSpy;

  beforeEach(async() => {
    // Get real project root BEFORE any changes - use actual module before mock is applied
    const actualPaths = jest.requireActual('../../lib/utils/paths');
    actualPaths.clearProjectRootCache();
    realProjectRoot = actualPaths.getProjectRoot();

    // Now get the mocked version for later use
    const { clearProjectRootCache, getProjectRoot } = require('../../lib/utils/paths');
    clearProjectRootCache();

    // Store original cwd
    originalCwd = process.cwd();

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aifabrix-test-'));
    process.chdir(tempDir);

    // Clear cache again after changing directory
    clearProjectRootCache();

    // Get real template paths BEFORE mocking - ensure realProjectRoot is defined
    if (!realProjectRoot) {
      throw new Error('realProjectRoot is undefined - cannot proceed with test setup');
    }
    const realTypescriptTemplate = path.join(realProjectRoot, 'templates', 'typescript', 'Dockerfile.hbs');
    const realPythonTemplate = path.join(realProjectRoot, 'templates', 'python', 'Dockerfile.hbs');

    // Use temp directory for templates to avoid writing to real project templates
    const tempTemplatesDir = path.join(tempDir, 'templates');
    const typescriptTemplateDir = path.join(tempTemplatesDir, 'typescript');
    const pythonTemplateDir = path.join(tempTemplatesDir, 'python');
    const typescriptTemplatePath = path.join(typescriptTemplateDir, 'Dockerfile.hbs');
    const pythonTemplatePath = path.join(pythonTemplateDir, 'Dockerfile.hbs');

    // Create templates directories in temp directory
    fsSync.mkdirSync(typescriptTemplateDir, { recursive: true });
    fsSync.mkdirSync(pythonTemplateDir, { recursive: true });

    // Always use minimal template for tests to ensure consistent results
    // Don't copy real template as it may have comments/formatting that tests don't expect
    const typescriptTemplateContent = `FROM node:20-alpine
WORKDIR /app
COPY {{appSourcePath}}package*.json ./
RUN npm install && npm cache clean --force
COPY {{appSourcePath}} .
EXPOSE {{port}}
{{#if healthCheck}}
HEALTHCHECK --interval={{healthCheck.interval}}s CMD curl -f http://localhost:{{port}}{{healthCheck.path}} || exit 1
{{/if}}
{{#if startupCommand}}
CMD {{startupCommand}}
{{/if}}`;
    fsSync.writeFileSync(typescriptTemplatePath, typescriptTemplateContent, 'utf8');

    // Always use minimal template for tests to ensure consistent results
    // Don't copy real template as it may have comments/formatting that tests don't expect
    const pythonTemplateContent = `FROM python:3.11-alpine
WORKDIR /app
COPY {{appSourcePath}}requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY {{appSourcePath}} .
EXPOSE {{port}}
{{#if healthCheck}}
HEALTHCHECK --interval={{healthCheck.interval}}s CMD curl -f http://localhost:{{port}}{{healthCheck.path}} || exit 1
{{/if}}
{{#if startupCommand}}
CMD {{startupCommand}}
{{/if}}`;
    fsSync.writeFileSync(pythonTemplatePath, pythonTemplateContent, 'utf8');

    // PERMANENT FIX: Mock getProjectRoot to return tempDir AND guard against writes to real templates
    pathsModule = require('../../lib/utils/paths');
    // Clear cache before mocking to ensure mock is used
    pathsModule.clearProjectRootCache();
    // Mock getProjectRoot to return tempDir (already mocked at module level)
    pathsModule.getProjectRoot.mockReturnValue(tempDir);
    getProjectRootSpy = pathsModule.getProjectRoot;

    // PERMANENT FIX: Guard fs.writeFileSync to prevent writes to real templates
    const originalWriteFileSync = fsSync.writeFileSync;
    const realTemplatesPath = path.resolve(realProjectRoot, 'templates');
    // Use the real template paths already declared above (lines 100-101), but normalize them
    const normalizedRealTypescriptTemplate = path.resolve(realTypescriptTemplate);
    const normalizedRealPythonTemplate = path.resolve(realPythonTemplate);

    writeFileSyncSpy = jest.spyOn(fsSync, 'writeFileSync').mockImplementation((filePath, ...args) => {
      // Normalize path to absolute - handle both absolute and relative paths
      const normalizedPath = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(process.cwd(), filePath);

      // Block ANY writes to real template files specifically
      if (normalizedPath === normalizedRealTypescriptTemplate || normalizedPath === normalizedRealPythonTemplate) {
        throw new Error(`TEST GUARD: Attempted to write to real template file: ${normalizedPath}. Tests must use temp directory: ${tempDir}`);
      }

      // Block ANY writes to real templates directory (but allow temp directory)
      const normalizedRealPath = path.resolve(realTemplatesPath);
      if (normalizedPath.startsWith(normalizedRealPath) && !normalizedPath.startsWith(tempDir)) {
        throw new Error(`TEST GUARD: Attempted to write to real template directory: ${normalizedPath}. Tests must use temp directory: ${tempDir}`);
      }

      return originalWriteFileSync.call(fsSync, filePath, ...args);
    });

    // Also guard fs.writeFile (async version)
    const originalWriteFile = fs.writeFile;
    writeFileSpy = jest.spyOn(fs, 'writeFile').mockImplementation((filePath, ...args) => {
      // Normalize path to absolute - handle both absolute and relative paths
      const normalizedPath = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(process.cwd(), filePath);

      // Block ANY writes to real template files specifically
      if (normalizedPath === normalizedRealTypescriptTemplate || normalizedPath === normalizedRealPythonTemplate) {
        return Promise.reject(new Error(`TEST GUARD: Attempted to write to real template file: ${normalizedPath}. Tests must use temp directory: ${tempDir}`));
      }

      // Block ANY writes to real templates directory (but allow temp directory)
      const normalizedRealPath = path.resolve(realTemplatesPath);
      if (normalizedPath.startsWith(normalizedRealPath) && !normalizedPath.startsWith(tempDir)) {
        return Promise.reject(new Error(`TEST GUARD: Attempted to write to real template directory: ${normalizedPath}. Tests must use temp directory: ${tempDir}`));
      }

      return originalWriteFile.call(fs, filePath, ...args);
    });

    // Reset docker-build mock
    dockerBuild.executeDockerBuild.mockClear();
    dockerBuild.executeDockerBuild.mockResolvedValue();
    dockerBuild.executeDockerBuildWithTag.mockClear();
    dockerBuild.executeDockerBuildWithTag.mockResolvedValue();
  });

  afterEach(async() => {
    // Restore all mocks to prevent interference between tests
    if (pathsModule && pathsModule.getProjectRoot) {
      pathsModule.getProjectRoot.mockReset();
    }
    if (writeFileSyncSpy) {
      writeFileSyncSpy.mockRestore();
    }
    if (writeFileSpy) {
      writeFileSpy.mockRestore();
    }

    // Restore original cwd
    try {
      process.chdir(originalCwd || require('os').homedir());
    } catch (e) {
      // Ignore chdir errors
    }

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('loadVariablesYaml', () => {
    it('should load and parse variables.yaml file', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      const mockConfig = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };

      // Create variables.yaml using sync write to ensure it's written immediately
      const variablesPath = path.join(appPath, 'variables.yaml');
      fsSync.writeFileSync(variablesPath, yaml.dump(mockConfig), 'utf8');

      // Verify file exists before calling loadVariablesYaml using sync check
      expect(fsSync.existsSync(variablesPath)).toBe(true);

      const result = await build.loadVariablesYaml(appName);
      expect(result).toEqual(mockConfig);
    });

    it('should throw error if variables.yaml not found', async() => {
      await expect(build.loadVariablesYaml('nonexistent-app'))
        .rejects.toThrow('Configuration not found. Run \'aifabrix create nonexistent-app\' first.');
    });

    it('should throw error for invalid YAML syntax', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      const variablesPath = path.join(appPath, 'variables.yaml');
      fsSync.writeFileSync(variablesPath, 'invalid: yaml: content: [[', 'utf8');

      // Verify file exists before calling loadVariablesYaml using sync check
      expect(fsSync.existsSync(variablesPath)).toBe(true);

      await expect(build.loadVariablesYaml(appName))
        .rejects.toThrow('Invalid YAML syntax in variables.yaml');
    });
  });

  describe('resolveContextPath', () => {
    it('should return current directory if no context path provided', () => {
      const builderPath = path.join(process.cwd(), 'builder', 'test-app');
      const result = build.resolveContextPath(builderPath, '');
      expect(result).toBe(process.cwd());
    });

    it('should resolve relative context path', async() => {
      const builderPath = path.join(process.cwd(), 'builder', 'test-app');
      const contextPath = 'src';

      // Ensure parent directories exist
      const builderParent = path.dirname(builderPath);
      await fs.mkdir(builderParent, { recursive: true });
      await fs.mkdir(builderPath, { recursive: true });

      // Create the context directory that the resolved path will point to
      const resolvedPath = path.resolve(builderPath, contextPath);
      fsSync.mkdirSync(resolvedPath, { recursive: true });

      const result = build.resolveContextPath(builderPath, contextPath);
      expect(result).toBe(resolvedPath);
      expect(fsSync.existsSync(result)).toBe(true);
    });

    it('should throw error if context path does not exist', () => {
      const builderPath = path.join(process.cwd(), 'builder', 'test-app');
      const contextPath = 'nonexistent';

      expect(() => build.resolveContextPath(builderPath, contextPath))
        .toThrow('Build context not found');
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript from package.json', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app-ts');
      await fs.mkdir(appPath, { recursive: true });

      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      const result = build.detectLanguage(appPath);
      expect(result).toBe('typescript');
    });

    it('should detect Python from requirements.txt', async() => {
      const appPath = path.resolve(process.cwd(), 'builder', 'test-app-py-req');
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Ensure no package.json exists that would override Python detection
      const packageJsonPath = path.join(appPath, 'package.json');
      try {
        await fs.unlink(packageJsonPath);
      } catch {
        // Ignore if doesn't exist
      }

      // Verify package.json doesn't exist using sync check (what detectLanguage uses)
      expect(fsSync.existsSync(packageJsonPath)).toBe(false);

      const requirementsPath = path.join(appPath, 'requirements.txt');
      fsSync.writeFileSync(requirementsPath, 'flask==2.0.0', 'utf8');

      // Verify requirements.txt exists using sync check (what detectLanguage uses)
      expect(fsSync.existsSync(requirementsPath)).toBe(true);
      // Also verify no package.json exists
      expect(fsSync.existsSync(packageJsonPath)).toBe(false);

      const result = build.detectLanguage(appPath);
      expect(result).toBe('python');
    });

    it('should detect Python from pyproject.toml', async() => {
      const appPath = path.resolve(process.cwd(), 'builder', 'test-app-py-toml');
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Ensure no package.json exists that would override Python detection
      const packageJsonPath = path.join(appPath, 'package.json');
      try {
        await fs.unlink(packageJsonPath);
      } catch {
        // Ignore if doesn't exist
      }

      // Verify package.json doesn't exist using sync check (what detectLanguage uses)
      expect(fsSync.existsSync(packageJsonPath)).toBe(false);

      const pyprojectPath = path.join(appPath, 'pyproject.toml');
      fsSync.writeFileSync(pyprojectPath, '[project]\nname = "test-app"', 'utf8');

      // Verify pyproject.toml exists using sync check (what detectLanguage uses)
      expect(fsSync.existsSync(pyprojectPath)).toBe(true);
      // Also verify no package.json exists
      expect(fsSync.existsSync(packageJsonPath)).toBe(false);

      const result = build.detectLanguage(appPath);
      expect(result).toBe('python');
    });

    it('should default to typescript if no indicators found', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const result = build.detectLanguage(appPath);
      expect(result).toBe('typescript');
    });
  });

  describe('generateDockerfile', () => {
    it('should generate TypeScript Dockerfile from template', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Templates should already exist from beforeEach in temp directory
      // But ensure they exist using sync operations to avoid timing issues
      const typescriptTemplateDir = path.join(tempDir, 'templates', 'typescript');
      const dockerfileTemplatePath = path.join(typescriptTemplateDir, 'Dockerfile.hbs');

      // Ensure templates directory exists in temp directory using sync
      if (!fsSync.existsSync(typescriptTemplateDir)) {
        fsSync.mkdirSync(typescriptTemplateDir, { recursive: true });
      }
      // Always create template to ensure it exists (sync operation)
      const templateContent = `FROM node:20-alpine
WORKDIR /app
COPY {{appSourcePath}}package*.json ./
RUN npm install && npm cache clean --force
COPY {{appSourcePath}} .
EXPOSE {{port}}
{{#if healthCheck}}
HEALTHCHECK --interval={{healthCheck.interval}}s CMD curl -f http://localhost:{{port}}{{healthCheck.path}} || exit 1
{{/if}}
{{#if startupCommand}}
CMD {{startupCommand}}
{{/if}}`;
      fsSync.writeFileSync(dockerfileTemplatePath, templateContent, 'utf8');

      // Verify template exists and mock is working
      expect(fsSync.existsSync(dockerfileTemplatePath)).toBe(true);
      const actualProjectRoot = pathsModule.getProjectRoot();
      expect(actualProjectRoot).toBe(tempDir);

      const config = {
        port: 3000,
        healthCheck: {
          interval: 30,
          path: '/health'
        },
        startupCommand: 'npm start'
      };

      const dockerfilePath = await build.generateDockerfile(appPath, 'typescript', config);

      expect(dockerfilePath).toMatch(/[\\/]\.aifabrix[\\/]test-app[\\/]Dockerfile$/);

      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
      expect(dockerfileContent).toContain('FROM node:20-alpine');
      expect(dockerfileContent).toContain('EXPOSE 3000');
      expect(dockerfileContent).toContain('HEALTHCHECK --interval=30s');
      expect(dockerfileContent).toContain('CMD npm start');
    });

    it('should generate Python Dockerfile from template', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Templates should already exist from beforeEach in temp directory
      // But ensure they exist using sync operations to avoid timing issues
      const pythonTemplateDir = path.join(tempDir, 'templates', 'python');
      const dockerfileTemplatePath = path.join(pythonTemplateDir, 'Dockerfile.hbs');

      // Ensure templates directory exists in temp directory using sync
      if (!fsSync.existsSync(pythonTemplateDir)) {
        fsSync.mkdirSync(pythonTemplateDir, { recursive: true });
      }
      // Always create template to ensure it exists (sync operation)
      const templateContent = `FROM python:3.11-alpine
WORKDIR /app
COPY {{appSourcePath}}requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY {{appSourcePath}} .
EXPOSE {{port}}
{{#if healthCheck}}
HEALTHCHECK --interval={{healthCheck.interval}}s CMD curl -f http://localhost:{{port}}{{healthCheck.path}} || exit 1
{{/if}}
{{#if startupCommand}}
CMD {{startupCommand}}
{{/if}}`;
      fsSync.writeFileSync(dockerfileTemplatePath, templateContent, 'utf8');

      // Verify template exists and mock is working
      expect(fsSync.existsSync(dockerfileTemplatePath)).toBe(true);
      const actualProjectRoot = pathsModule.getProjectRoot();
      expect(actualProjectRoot).toBe(tempDir);

      const config = {
        port: 8080,
        healthCheck: {
          interval: 60,
          path: '/health'
        },
        startupCommand: 'python app.py'
      };

      const dockerfilePath = await build.generateDockerfile(appPath, 'python', config);

      expect(dockerfilePath).toMatch(/[\\/]\.aifabrix[\\/]test-app[\\/]Dockerfile$/);

      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
      expect(dockerfileContent).toContain('FROM python:3.11-alpine');
      expect(dockerfileContent).toContain('EXPOSE 8080');
      expect(dockerfileContent).toContain('HEALTHCHECK --interval=60s');
      expect(dockerfileContent).toContain('CMD python app.py');
    });

    it('should throw error for unsupported language', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const config = { port: 3000 };

      await expect(build.generateDockerfile(appPath, 'unsupported', config))
        .rejects.toThrow('Template not found for language: unsupported');
    });
  });

  describe('buildApp', () => {
    it('should build application with generated Dockerfile', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Templates should already exist from beforeEach in temp directory
      const typescriptTemplateDir = path.join(tempDir, 'templates', 'typescript');
      const dockerfileTemplatePath = path.join(typescriptTemplateDir, 'Dockerfile.hbs');
      if (!fsSync.existsSync(typescriptTemplateDir)) {
        await fs.mkdir(typescriptTemplateDir, { recursive: true });
      }
      if (!fsSync.existsSync(dockerfileTemplatePath)) {
        const templateContent = `FROM node:20-alpine
WORKDIR /app
COPY {{appSourcePath}}package*.json ./
RUN npm install && npm cache clean --force
COPY {{appSourcePath}} .
EXPOSE {{port}}
{{#if healthCheck}}
HEALTHCHECK --interval={{healthCheck.interval}}s CMD curl -f http://localhost:{{port}}{{healthCheck.path}} || exit 1
{{/if}}
{{#if startupCommand}}
CMD {{startupCommand}}
{{/if}}`;
        await fs.writeFile(dockerfileTemplatePath, templateContent, 'utf8');
      }

      // Create variables.yaml
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock secrets
      jest.spyOn(secrets, 'generateEnvFile').mockResolvedValue('/path/to/.env');
      // Ensure deterministic developer id for test stability
      jest.spyOn(configModule, 'getDeveloperId').mockResolvedValue(0);

      // Get the mock function before buildApp is called
      const util = require('util');
      const { exec } = require('child_process');
      const runFunction = util.promisify(exec);

      const result = await build.buildApp(appName);
      expect(result).toBe(`${appName}:latest`);
      // Ensure docker build was called with developer-scoped image name (dev<number> or extra)
      expect(dockerBuild.executeDockerBuildWithTag).toHaveBeenCalled();
      const builtImageName = dockerBuild.executeDockerBuildWithTag.mock.calls[0][0];
      expect(builtImageName).toMatch(new RegExp(`^${appName}-(dev\\d+|extra)$`));
      // Note: docker tag command is called inside executeDockerBuildWithTag, but since
      // that function is mocked, we can't verify the tag command directly in this unit test.
      // Integration tests verify the actual docker tag behavior.
    });

    it('should use custom Dockerfile when specified', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml with custom Dockerfile
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`,
        build: {
          dockerfile: 'CustomDockerfile'
        }
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create custom Dockerfile
      await fs.writeFile(path.join(appPath, 'CustomDockerfile'), 'FROM node:18');

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock secrets
      jest.spyOn(secrets, 'generateEnvFile').mockResolvedValue('/path/to/.env');

      const result = await build.buildApp(appName);
      expect(result).toBe(`${appName}:latest`);
    });

    it('should use existing Dockerfile in builder/{appName}/ directory', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml (without custom dockerfile path)
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`,
        build: {
          context: '..'
        }
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create Dockerfile directly in builder/{appName}/ directory
      await fs.writeFile(path.join(appPath, 'Dockerfile'), 'FROM keycloak:24.0\nWORKDIR /opt/keycloak');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock secrets
      jest.spyOn(secrets, 'generateEnvFile').mockResolvedValue('/path/to/.env');

      const result = await build.buildApp(appName);
      expect(result).toBe(`${appName}:latest`);
    });

    it('should force template regeneration when requested', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Templates should already exist from beforeEach in temp directory
      const typescriptTemplateDir = path.join(tempDir, 'templates', 'typescript');
      const dockerfileTemplatePath = path.join(typescriptTemplateDir, 'Dockerfile.hbs');
      if (!fsSync.existsSync(typescriptTemplateDir)) {
        await fs.mkdir(typescriptTemplateDir, { recursive: true });
      }
      if (!fsSync.existsSync(dockerfileTemplatePath)) {
        const templateContent = `FROM node:20-alpine
WORKDIR /app
COPY {{appSourcePath}}package*.json ./
RUN npm install && npm cache clean --force
COPY {{appSourcePath}} .
EXPOSE {{port}}
{{#if healthCheck}}
HEALTHCHECK --interval={{healthCheck.interval}}s CMD curl -f http://localhost:{{port}}{{healthCheck.path}} || exit 1
{{/if}}
{{#if startupCommand}}
CMD {{startupCommand}}
{{/if}}`;
        await fs.writeFile(dockerfileTemplatePath, templateContent, 'utf8');
      }

      // Create variables.yaml
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock secrets
      jest.spyOn(secrets, 'generateEnvFile').mockResolvedValue('/path/to/.env');

      const result = await build.buildApp(appName, { forceTemplate: true });
      expect(result).toBe(`${appName}:latest`);
    });

    it('should handle validation errors', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      // Ensure parent directory exists first
      const parentDir = path.dirname(appPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml with invalid port
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 99999, // Invalid port
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Mock validator to return errors
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({
        valid: false,
        errors: ['Port must be between 1 and 65535']
      });

      await expect(build.buildApp(appName))
        .rejects.toThrow('Configuration validation failed');
    });

    it.skip('should handle Docker build errors', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock Docker build to fail
      const util = require('util');
      util.promisify = jest.fn(() => jest.fn().mockRejectedValue(new Error('Docker build failed')));

      await expect(build.buildApp(appName))
        .rejects.toThrow('Build failed: Docker build failed');
    });
  });
});
