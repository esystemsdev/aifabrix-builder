/**
 * @fileoverview Tests for lib/utils/port-resolver.js
 */

const fs = require('fs');
const {
  getContainerPort,
  getLocalPort,
  getContainerPortFromPath,
  getLocalPortFromPath,
  loadVariablesFromPath
} = require('../../../lib/utils/port-resolver');

jest.mock('fs');

describe('port-resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getContainerPort', () => {
    it('returns port when only variables.port is set', () => {
      expect(getContainerPort({ port: 8080 })).toBe(8080);
      expect(getContainerPort({ port: 3001 }, 3000)).toBe(3001);
    });

    it('returns build.containerPort when set, overrides port', () => {
      expect(getContainerPort({ port: 8080, build: { containerPort: 9090 } })).toBe(9090);
      expect(getContainerPort({ build: { containerPort: 8081 } }, 3000)).toBe(8081);
    });

    it('falls back to port when build.containerPort is undefined', () => {
      expect(getContainerPort({ port: 4000, build: {} })).toBe(4000);
      expect(getContainerPort({ port: 4000, build: { localPort: 5000 } })).toBe(4000);
    });

    it('returns defaultPort when neither containerPort nor port is set', () => {
      expect(getContainerPort({})).toBe(3000);
      expect(getContainerPort({}, 5000)).toBe(5000);
      expect(getContainerPort({ build: {} })).toBe(3000);
    });

    it('handles null/undefined variables', () => {
      expect(getContainerPort(null)).toBe(3000);
      expect(getContainerPort(undefined)).toBe(3000);
      expect(getContainerPort(null, 8080)).toBe(8080);
    });
  });

  describe('getLocalPort', () => {
    it('returns port when only variables.port is set', () => {
      expect(getLocalPort({ port: 8080 })).toBe(8080);
    });

    it('returns build.localPort when it is a positive number', () => {
      expect(getLocalPort({ port: 8080, build: { localPort: 3010 } })).toBe(3010);
      expect(getLocalPort({ build: { localPort: 3020 } }, 3000)).toBe(3020);
    });

    it('falls back to port when build.localPort is 0 or not a positive number', () => {
      expect(getLocalPort({ port: 8080, build: { localPort: 0 } })).toBe(8080);
      expect(getLocalPort({ port: 8080, build: { localPort: -1 } })).toBe(8080);
      expect(getLocalPort({ port: 8080, build: { localPort: undefined } })).toBe(8080);
      expect(getLocalPort({ port: 8080, build: { localPort: '3010' } })).toBe(8080);
    });

    it('returns defaultPort when neither localPort nor port is set', () => {
      expect(getLocalPort({})).toBe(3000);
      expect(getLocalPort({}, 5000)).toBe(5000);
    });

    it('handles null/undefined variables', () => {
      expect(getLocalPort(null)).toBe(3000);
      expect(getLocalPort(undefined, 8080)).toBe(8080);
    });
  });

  describe('loadVariablesFromPath', () => {
    it('returns null when path is empty or missing', () => {
      expect(loadVariablesFromPath('')).toBeNull();
      expect(loadVariablesFromPath(null)).toBeNull();
      expect(loadVariablesFromPath(undefined)).toBeNull();
    });

    it('returns null when file does not exist', () => {
      fs.existsSync = jest.fn().mockReturnValue(false);
      expect(loadVariablesFromPath('/some/application.yaml')).toBeNull();
      expect(fs.existsSync).toHaveBeenCalledWith('/some/application.yaml');
    });

    it('returns parsed YAML when file exists', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('port: 8080\nbuild:\n  localPort: 3010');
      const result = loadVariablesFromPath('/app/application.yaml');
      expect(result).toEqual({ port: 8080, build: { localPort: 3010 } });
    });

    it('returns null on parse error', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('invalid: yaml: [');
      const yaml = require('js-yaml');
      const spy = jest.spyOn(yaml, 'load').mockImplementation(() => {
        throw new Error('parse error');
      });
      expect(loadVariablesFromPath('/app/application.yaml')).toBeNull();
      spy.mockRestore();
    });
  });

  describe('getContainerPortFromPath', () => {
    it('returns null when path is missing or file does not exist', () => {
      fs.existsSync = jest.fn().mockReturnValue(false);
      expect(getContainerPortFromPath('')).toBeNull();
      expect(getContainerPortFromPath(null)).toBeNull();
      fs.existsSync = jest.fn().mockReturnValue(false);
      expect(getContainerPortFromPath('/nonexistent.yaml')).toBeNull();
    });

    it('returns containerPort when set in file', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('build:\n  containerPort: 8081');
      expect(getContainerPortFromPath('/app/application.yaml')).toBe(8081);
    });

    it('returns port when containerPort not set', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('port: 4000');
      expect(getContainerPortFromPath('/app/application.yaml')).toBe(4000);
    });

    it('returns null when neither containerPort nor port is set', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('app:\n  key: myapp');
      expect(getContainerPortFromPath('/app/application.yaml')).toBeNull();
    });
  });

  describe('getLocalPortFromPath', () => {
    it('returns null when path is missing or file does not exist', () => {
      fs.existsSync = jest.fn().mockReturnValue(false);
      expect(getLocalPortFromPath('')).toBeNull();
      expect(getLocalPortFromPath('/nonexistent.yaml')).toBeNull();
    });

    it('returns build.localPort when it is a positive number', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('build:\n  localPort: 3010');
      expect(getLocalPortFromPath('/app/application.yaml')).toBe(3010);
    });

    it('falls back to port when localPort is 0 or invalid', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('port: 4000\nbuild:\n  localPort: 0');
      expect(getLocalPortFromPath('/app/application.yaml')).toBe(4000);
    });

    it('returns null when neither localPort nor port is set', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('app:\n  key: myapp');
      expect(getLocalPortFromPath('/app/application.yaml')).toBeNull();
    });

    it('returns port when build.localPort is not a positive number', () => {
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.readFileSync = jest.fn().mockReturnValue('port: 5000');
      expect(getLocalPortFromPath('/app/application.yaml')).toBe(5000);
    });
  });
});
