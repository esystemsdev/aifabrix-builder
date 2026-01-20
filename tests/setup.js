/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Preserve the original working directory to avoid ENOENT errors if tests change/remove CWD
const ORIGINAL_CWD = process.cwd();

// Set project root in global scope for use by getProjectRoot()
// This ensures templates can be found even when tests change process.cwd()
const path = require('path');
const fs = require('fs');
let PROJECT_ROOT = null;

// Try to find project root by looking for package.json
let currentDir = __dirname;
for (let i = 0; i < 10; i++) {
  const packageJsonPath = path.join(currentDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    PROJECT_ROOT = currentDir;
    break;
  }
  const parentDir = path.dirname(currentDir);
  if (parentDir === currentDir) {
    break;
  }
  currentDir = parentDir;
}

// Fallback to __dirname relative path (tests/ -> project root)
if (!PROJECT_ROOT) {
  PROJECT_ROOT = path.resolve(__dirname, '..');
}

// Ensure PROJECT_ROOT is always an absolute path
PROJECT_ROOT = path.resolve(PROJECT_ROOT);

// Set in global scope
global.PROJECT_ROOT = PROJECT_ROOT;

// PERMANENT FIX: Add global guard to prevent writes to real template files
// This guard is active for ALL tests and prevents ANY writes to templates directory
const realTemplatesPath = path.resolve(PROJECT_ROOT, 'templates');
const realTypescriptTemplate = path.resolve(PROJECT_ROOT, 'templates', 'typescript', 'Dockerfile.hbs');
const realPythonTemplate = path.resolve(PROJECT_ROOT, 'templates', 'python', 'Dockerfile.hbs');

// PERMANENT FIX: Guard fs.writeFileSync globally to prevent writes to real template files
// This guard blocks ALL writes to template files in development
// In CI, templates can be created if they don't exist (handled below)
const originalWriteFileSync = fs.writeFileSync;
const originalMkdirSync = fs.mkdirSync;
const originalExistsSync = fs.existsSync;
const isCIEnv = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

// Store flag to allow setup.js to create templates in CI (only during setup)
let allowSetupTemplateCreation = false;

// Helper to check if path is protected (not a temp directory)
function isProtectedPath(normalizedPath) {
  // Allow writes to temp directories (common temp prefixes)
  const isTempPath = normalizedPath.includes('/tmp/') ||
                     normalizedPath.includes('\\temp\\') ||
                     normalizedPath.startsWith('/var/folders/') ||
                     normalizedPath.includes('aifabrix-test-') ||
                     normalizedPath.includes('aifabrix-') ||
                     process.cwd().includes('/tmp/');

  if (isTempPath) {
    return false;
  }

  // Check if writing to node_modules
  const nodeModulesPath = path.resolve(PROJECT_ROOT, 'node_modules');
  if (normalizedPath.startsWith(nodeModulesPath)) {
    return true;
  }

  // In CI environment, allow writes to templates
  if (isCIEnv) {
    return false;
  }

  // Check if writing to real template files
  if (normalizedPath === realTypescriptTemplate || normalizedPath === realPythonTemplate) {
    return !allowSetupTemplateCreation;
  }

  // Check if writing to templates directory
  if (normalizedPath.startsWith(realTemplatesPath)) {
    return true;
  }

  return false;
}

fs.writeFileSync = function(filePath, ...args) {
  const normalizedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(process.cwd(), filePath);

  if (isProtectedPath(normalizedPath)) {
    if (normalizedPath.startsWith(path.resolve(PROJECT_ROOT, 'node_modules'))) {
      throw new Error(`GLOBAL GUARD: Attempted to write to node_modules: ${normalizedPath}. Tests must NEVER modify node_modules files.`);
    }
    throw new Error(`GLOBAL GUARD: Attempted to write to protected path: ${normalizedPath}. Tests must NEVER modify real templates.`);
  }

  return originalWriteFileSync.call(fs, filePath, ...args);
};

// PERMANENT FIX: NEVER write to real template files in development
// Templates should exist and should NEVER be modified by tests
// Only create templates in CI simulation environments where they might not exist
try {
  const templatesExist = fs.existsSync(realTypescriptTemplate) && fs.existsSync(realPythonTemplate);

  // PERMANENT GUARD: In development (non-CI), NEVER write to templates
  // If templates exist, they should NEVER be overwritten
  if (!isCIEnv && templatesExist) {
    // Templates exist in development - do nothing, never write to them
    // This is the normal case - templates should already exist
  } else if (!isCIEnv && !templatesExist) {
    // Templates don't exist in development - warn but don't create
    // Developer should have templates already
    console.warn('Warning: Template files not found. Tests may fail. Templates should exist in project.');
  } else if (isCIEnv && !templatesExist) {
    // Only in CI: create templates if they don't exist
    // Temporarily allow template creation for setup.js only
    allowSetupTemplateCreation = true;

    try {
      const typescriptTemplateDir = path.join(PROJECT_ROOT, 'templates', 'typescript');
      const pythonTemplateDir = path.join(PROJECT_ROOT, 'templates', 'python');

      // Create directories if needed
      if (!fs.existsSync(typescriptTemplateDir)) {
        fs.mkdirSync(typescriptTemplateDir, { recursive: true });
      }
      if (!fs.existsSync(pythonTemplateDir)) {
        fs.mkdirSync(pythonTemplateDir, { recursive: true });
      }

      // Create templates only if they don't exist
      if (!fs.existsSync(realTypescriptTemplate)) {
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
        fs.writeFileSync(realTypescriptTemplate, templateContent, 'utf8');
      }
      if (!fs.existsSync(realPythonTemplate)) {
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
        fs.writeFileSync(realPythonTemplate, templateContent, 'utf8');
      }
    } finally {
      // Always disable template creation after setup
      allowSetupTemplateCreation = false;
    }
  }
  // If templates exist in CI, do nothing - never overwrite
} catch (error) {
  // Always disable template creation on error
  allowSetupTemplateCreation = false;
  // If template creation fails, log but don't fail tests
  if (process.env.NODE_ENV !== 'test' || !error.message.includes('ENOENT')) {
    console.warn('Warning: Could not ensure templates exist in setup:', error.message);
  }
}

// Global test timeout
jest.setTimeout(5000); // Should be < 0.5s with proper mocking

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock global fetch to prevent real HTTP calls
// Default implementation returns a successful JSON response
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: {
    get: jest.fn().mockReturnValue('application/json')
  },
  json: jest.fn().mockResolvedValue({ success: true }),
  text: jest.fn().mockResolvedValue('OK')
});

// Mock axios to prevent real HTTP calls
// Default implementation returns a successful response
jest.mock('axios', () => {
  const axios = jest.requireActual('axios');
  return {
    ...axios,
    default: {
      ...axios.default,
      get: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      post: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      put: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      delete: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      patch: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      request: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' })
    },
    get: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    post: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    put: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    delete: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    patch: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    request: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' })
  };
});

// Global test utilities
global.testUtils = {
  // Helper to create temporary test files
  createTempFile: (content) => {
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `test-${Date.now()}.tmp`);
    fs.writeFileSync(tempFile, content);
    return tempFile;
  },

  // Helper to clean up temporary files
  cleanupTempFiles: () => {
    // Use jest.requireActual to get the real fs module, not the mocked one
    const fs = jest.requireActual('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
};

// Reset mocks before each test to ensure clean state
// NOTE: We do NOT call jest.resetModules() here because:
// 1. It can cause real modules to load if they're required after resetModules()
// 2. jest.mock() calls are hoisted and persist anyway
// 3. Most tests don't need module cache reset - they just need mock state reset
beforeEach(() => {
  // Reset fetch mock to default implementation
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: jest.fn().mockReturnValue('application/json')
      },
      json: jest.fn().mockResolvedValue({ success: true }),
      text: jest.fn().mockResolvedValue('OK')
    });
  }

  // Clear all mocks to ensure clean state between tests
  // This resets mock call history but keeps the mock implementations
  jest.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  global.testUtils.cleanupTempFiles();
  // Always restore the original working directory to ensure Jest reporters/workers have a valid CWD
  try {
    process.chdir(ORIGINAL_CWD);
  } catch (e) {
    // Ignore; if ORIGINAL_CWD were somehow invalid, Jest will still fail loudly elsewhere
  }
});

// Cleanup after all tests
afterAll(() => {
  global.testUtils.cleanupTempFiles();
  // Ensure final CWD is valid for coverage reporters
  try {
    process.chdir(ORIGINAL_CWD);
  } catch (e) {
    // Ignore
  }
});
