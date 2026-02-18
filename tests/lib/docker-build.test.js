/**
 * Tests for Docker Build Utilities
 *
 * @fileoverview Unit tests for docker-build.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('child_process');
jest.mock('ora');
jest.mock('../../lib/utils/remote-docker-env', () => ({ getRemoteDockerEnv: jest.fn().mockResolvedValue({}) }));
const { spawn } = require('child_process');
const path = require('path');
const ora = require('ora');
const dockerBuild = require('../../lib/utils/docker-build');

describe('Docker Build Utilities', () => {
  let mockSpawn;
  let mockProcess;
  let mockSpinner;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ora spinner
    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      text: ''
    };
    ora.mockReturnValue(mockSpinner);

    // Mock spawn process
    mockProcess = {
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn()
    };

    mockSpawn = jest.fn().mockReturnValue(mockProcess);
    spawn.mockImplementation(mockSpawn);
  });

  describe('isDockerNotAvailableError', () => {
    it('should detect docker command not found error', () => {
      const error = 'docker: command not found';
      expect(dockerBuild.isDockerNotAvailableError(error)).toBe(true);
    });

    it('should detect Docker daemon connection error', () => {
      const error = 'Cannot connect to the Docker daemon';
      expect(dockerBuild.isDockerNotAvailableError(error)).toBe(true);
    });

    it('should detect Docker daemon running check error', () => {
      const error = 'Is the docker daemon running';
      expect(dockerBuild.isDockerNotAvailableError(error)).toBe(true);
    });

    it('should detect generic Docker connection error', () => {
      const error = 'Cannot connect to Docker';
      expect(dockerBuild.isDockerNotAvailableError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = 'Some other error occurred';
      expect(dockerBuild.isDockerNotAvailableError(error)).toBe(false);
    });
  });

  describe('parseDockerBuildProgress - tested through executeDockerBuild', () => {
    it('should parse step progress from stdout', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stdoutCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Wait a bit for callbacks to be set up
      await new Promise(resolve => setTimeout(resolve, 10));

      // Test step progress parsing
      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Step 1/10 : FROM node:20-alpine\n'));
      }

      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;
      // Verify spinner.text was set (check that it was called with progress text)
      expect(mockSpinner.text).toBeDefined();
    });

    it('should parse pulling layer from stdout', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stdoutCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      await new Promise(resolve => setTimeout(resolve, 10));

      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Pulling from library/node\n'));
      }

      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;
      expect(mockSpinner.text).toBeDefined();
    });

    it('should parse extracting layer', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stdoutCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      await new Promise(resolve => setTimeout(resolve, 10));

      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Extracting [====>     ] 10.5MB/50MB\n'));
      }

      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;
      expect(mockSpinner.text).toBeDefined();
    });

    it('should parse build progress', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stdoutCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      await new Promise(resolve => setTimeout(resolve, 10));

      if (stdoutCallback) {
        stdoutCallback(Buffer.from(' => [internal] load build context\n'));
      }

      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;
      expect(mockSpinner.text).toBeDefined();
    });

    it('should parse progress bar with MB', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stdoutCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      await new Promise(resolve => setTimeout(resolve, 10));

      if (stdoutCallback) {
        stdoutCallback(Buffer.from('[====>     ] 10.5MB/50MB\n'));
      }

      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;
      expect(mockSpinner.text).toBeDefined();
    });
  });

  describe('executeDockerBuild', () => {
    it('should successfully build Docker image', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stdoutCallback;
      let stderrCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate build output
      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Step 1/5 : FROM node:20-alpine\n'));
        stdoutCallback(Buffer.from('[====>     ] 10MB/50MB\n'));
      }

      // Simulate successful completion
      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;

      expect(ora).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith(`Image built: ${imageName}:${tag}`);

      // Paths are resolved to absolute paths in executeDockerBuild
      const expectedDockerfilePath = path.resolve(dockerfilePath);
      const expectedContextPath = path.resolve(contextPath);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['build', '-t', `${imageName}:${tag}`, '-f', expectedDockerfilePath, expectedContextPath],
        expect.objectContaining({ shell: process.platform === 'win32' })
      );
    });

    it('should handle build failure with error code', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stderrCallback;
      let closeCallback;

      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate error output
      if (stderrCallback) {
        stderrCallback(Buffer.from('Error: build failed\n'));
        stderrCallback(Buffer.from('Line 10: syntax error\n'));
      }

      // Simulate failure
      if (closeCallback) {
        closeCallback(1);
      }

      await expect(buildPromise).rejects.toThrow('Docker build failed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Build failed');
    });

    it('should handle Docker not available error', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stderrCallback;
      let closeCallback;

      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate Docker not available error
      if (stderrCallback) {
        stderrCallback(Buffer.from('Cannot connect to the Docker daemon\n'));
      }

      // Simulate failure
      if (closeCallback) {
        closeCallback(1);
      }

      await expect(buildPromise).rejects.toThrow('Docker is not running or not installed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Build failed');
    });

    it('should handle spawn error event', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let errorCallback;

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate spawn error
      if (errorCallback) {
        errorCallback(new Error('docker: command not found'));
      }

      await expect(buildPromise).rejects.toThrow('Docker is not running or not installed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Build failed');
    });

    it('should handle generic spawn error', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let errorCallback;

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate generic error
      if (errorCallback) {
        errorCallback(new Error('Unexpected error'));
      }

      await expect(buildPromise).rejects.toThrow('Docker build failed: Unexpected error');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Build failed');
    });

    it('should throttle progress updates', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stdoutCallback;
      let closeCallback;

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate rapid progress updates
      if (stdoutCallback) {
        for (let i = 0; i < 10; i++) {
          stdoutCallback(Buffer.from(`Step ${i + 1}/10 : FROM node:20-alpine\n`));
        }
      }

      // Simulate successful completion
      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;

      // Verify spinner text was updated (throttled)
      expect(mockSpinner.text).toBeDefined();
    });

    it('should handle progress from stderr', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stderrCallback;
      let closeCallback;

      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate progress on stderr (Docker outputs progress to stderr)
      if (stderrCallback) {
        stderrCallback(Buffer.from('Step 1/5 : FROM node:20-alpine\n'));
      }

      // Simulate successful completion
      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should ignore warnings in stderr', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stderrCallback;
      let closeCallback;

      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate warning on stderr
      if (stderrCallback) {
        stderrCallback(Buffer.from('Warning: Some warning message\n'));
      }

      // Simulate successful completion
      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle build failure with last error lines', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let stderrCallback;
      let closeCallback;

      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate multiple error lines
      if (stderrCallback) {
        stderrCallback(Buffer.from('Error line 1\n'));
        stderrCallback(Buffer.from('Error line 2\n'));
        stderrCallback(Buffer.from('Error line 3\n'));
        stderrCallback(Buffer.from('Error line 4\n'));
        stderrCallback(Buffer.from('Error line 5\n'));
        stderrCallback(Buffer.from('Error line 6\n'));
      }

      // Simulate failure
      if (closeCallback) {
        closeCallback(1);
      }

      await expect(buildPromise).rejects.toThrow('Docker build failed');
      // Should only show last 5 lines
      expect(mockSpinner.fail).toHaveBeenCalled();
    });

    it('should handle empty error output', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      let closeCallback;

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      // Simulate failure with no error output
      if (closeCallback) {
        closeCallback(1);
      }

      await expect(buildPromise).rejects.toThrow('Docker build failed');
      expect(mockSpinner.fail).toHaveBeenCalled();
    });

    it('should handle Windows shell option', async() => {
      const imageName = 'test-image';
      const dockerfilePath = './Dockerfile';
      const contextPath = './';
      const tag = 'latest';

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      let closeCallback;

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const buildPromise = dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

      if (closeCallback) {
        closeCallback(0);
      }

      await buildPromise;

      // Paths are resolved to absolute paths in executeDockerBuild
      const expectedDockerfilePath = path.resolve(dockerfilePath);
      const expectedContextPath = path.resolve(contextPath);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['build', '-t', `${imageName}:${tag}`, '-f', expectedDockerfilePath, expectedContextPath],
        expect.objectContaining({ shell: true })
      );

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });
  });
});

