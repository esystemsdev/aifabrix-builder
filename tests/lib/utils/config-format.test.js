/**
 * Tests for config format converter (YAML/JSON at I/O boundary)
 *
 * @fileoverview Unit tests for config-format.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');

jest.mock('fs');

const {
  yamlToJson,
  jsonToYaml,
  loadConfigFile,
  writeConfigFile,
  isYamlPath,
  isJsonPath
} = require('../../../lib/utils/config-format');

describe('config-format', () => {
  describe('yamlToJson', () => {
    it('parses valid YAML string to object', () => {
      const yaml = 'app:\n  name: myapp\n  port: 3000';
      expect(yamlToJson(yaml)).toEqual({ app: { name: 'myapp', port: 3000 } });
    });

    it('returns empty object for empty document', () => {
      expect(yamlToJson('')).toEqual({});
    });

    it('throws on invalid YAML', () => {
      expect(() => yamlToJson('foo: [unclosed')).toThrow(/Invalid YAML syntax/);
    });

    it('throws when content is not a string', () => {
      expect(() => yamlToJson(null)).toThrow('yamlToJson expects a string');
      expect(() => yamlToJson(123)).toThrow('yamlToJson expects a string');
    });

    it('parses YAML with arrays and nested objects', () => {
      const yaml = 'app:\n  name: myapp\n  ports:\n    - 3000\n    - 3001';
      expect(yamlToJson(yaml)).toEqual({ app: { name: 'myapp', ports: [3000, 3001] } });
    });

    it('preserves numeric and boolean types', () => {
      const yaml = 'port: 3000\nenabled: true\ncount: 42';
      expect(yamlToJson(yaml)).toEqual({ port: 3000, enabled: true, count: 42 });
    });
  });

  describe('jsonToYaml', () => {
    it('serializes object to YAML string', () => {
      const obj = { app: { name: 'myapp', port: 3000 } };
      const out = jsonToYaml(obj);
      expect(typeof out).toBe('string');
      expect(out).toContain('app:');
      expect(out).toContain('name: myapp');
    });

    it('returns empty string for null/undefined', () => {
      expect(jsonToYaml(null)).toBe('');
      expect(jsonToYaml(undefined)).toBe('');
    });

    it('serializes object with arrays', () => {
      const obj = { app: { name: 'myapp', ports: [3000, 3001] } };
      const out = jsonToYaml(obj);
      expect(out).toContain('ports:');
      expect(out).toContain('3000');
      expect(out).toContain('3001');
    });

    it('serializes empty object to YAML', () => {
      const out = jsonToYaml({});
      expect(typeof out).toBe('string');
      expect(yamlToJson(out)).toEqual({});
    });
  });

  describe('isYamlPath / isJsonPath', () => {
    it('isYamlPath returns true for .yaml and .yml', () => {
      expect(isYamlPath('/dir/application.yaml')).toBe(true);
      expect(isYamlPath('/dir/application.yml')).toBe(true);
      expect(isYamlPath('/dir/foo.YAML')).toBe(true);
      expect(isYamlPath('/dir/application.json')).toBe(false);
    });

    it('isJsonPath returns true for .json', () => {
      expect(isJsonPath('/dir/application.json')).toBe(true);
      expect(isJsonPath('/dir/app.JSON')).toBe(true);
      expect(isJsonPath('/dir/application.yaml')).toBe(false);
    });
  });

  describe('loadConfigFile', () => {
    const appYaml = path.join('/app', 'application.yaml');
    const appJson = path.join('/app', 'application.json');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('loads YAML file and returns object', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('app:\n  name: myapp');
      const result = loadConfigFile(appYaml);
      expect(result).toEqual({ app: { name: 'myapp' } });
      expect(fs.readFileSync).toHaveBeenCalledWith(appYaml, 'utf8');
    });

    it('loads JSON file and returns object', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{"app":{"name":"myapp"}}');
      const result = loadConfigFile(appJson);
      expect(result).toEqual({ app: { name: 'myapp' } });
    });

    it('loads .yml file and returns object', () => {
      const appYml = path.join('/app', 'application.yml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('app:\n  name: myapp');
      const result = loadConfigFile(appYml);
      expect(result).toEqual({ app: { name: 'myapp' } });
      expect(fs.readFileSync).toHaveBeenCalledWith(appYml, 'utf8');
    });

    it('throws when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(() => loadConfigFile(appYaml)).toThrow(/Config file not found/);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('throws when JSON is invalid', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid }');
      expect(() => loadConfigFile(appJson)).toThrow(/Invalid JSON syntax/);
    });

    it('throws on unsupported extension', () => {
      fs.existsSync.mockReturnValue(true);
      expect(() => loadConfigFile('/app/config.txt')).toThrow(/Unsupported config file extension/);
    });

    it('throws when filePath is empty', () => {
      expect(() => loadConfigFile('')).toThrow('loadConfigFile requires a non-empty file path');
    });

    it('throws when filePath is not a string', () => {
      expect(() => loadConfigFile(undefined)).toThrow('loadConfigFile requires a non-empty file path');
      expect(() => loadConfigFile(null)).toThrow('loadConfigFile requires a non-empty file path');
    });
  });

  describe('writeConfigFile', () => {
    const yamlPath = path.join('/app', 'application.yaml');
    const jsonPath = path.join('/app', 'application.json');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('writes object as YAML when path has .yaml', () => {
      writeConfigFile(yamlPath, { app: { name: 'myapp' } });
      expect(fs.writeFileSync).toHaveBeenCalledWith(yamlPath, expect.any(String), 'utf8');
      const written = fs.writeFileSync.mock.calls[0][1];
      expect(written).toContain('app:');
    });

    it('writes object as JSON when path has .json', () => {
      writeConfigFile(jsonPath, { app: { name: 'myapp' } });
      expect(fs.writeFileSync).toHaveBeenCalledWith(jsonPath, expect.any(String), 'utf8');
      const written = fs.writeFileSync.mock.calls[0][1];
      expect(JSON.parse(written)).toEqual({ app: { name: 'myapp' } });
    });

    it('accepts explicit format yaml', () => {
      writeConfigFile('/app/config.foo', { x: 1 }, 'yaml');
      expect(fs.writeFileSync).toHaveBeenCalled();
      const written = fs.writeFileSync.mock.calls[0][1];
      expect(written).toContain('x: 1');
    });

    it('accepts explicit format json', () => {
      writeConfigFile('/app/config.foo', { x: 1 }, 'json');
      const written = fs.writeFileSync.mock.calls[0][1];
      expect(JSON.parse(written)).toEqual({ x: 1 });
    });

    it('writes object as YAML when path has .yml', () => {
      const ymlPath = path.join('/app', 'application.yml');
      writeConfigFile(ymlPath, { app: { name: 'myapp' } });
      expect(fs.writeFileSync).toHaveBeenCalledWith(ymlPath, expect.any(String), 'utf8');
      const written = fs.writeFileSync.mock.calls[0][1];
      expect(written).toContain('app:');
    });

    it('throws when format is invalid', () => {
      expect(() => writeConfigFile('/app/config.yaml', {}, 'xml')).toThrow(/Invalid format/);
    });

    it('throws when filePath is empty', () => {
      expect(() => writeConfigFile('', {})).toThrow('writeConfigFile requires a non-empty file path');
    });

    it('throws when filePath is not a string', () => {
      expect(() => writeConfigFile(undefined, {})).toThrow('writeConfigFile requires a non-empty file path');
      expect(() => writeConfigFile(null, {})).toThrow('writeConfigFile requires a non-empty file path');
    });

    it('round-trip: jsonToYaml then yamlToJson preserves data', () => {
      const obj = { app: { name: 'myapp', port: 3000 }, build: { language: 'typescript' } };
      const yamlStr = jsonToYaml(obj);
      const back = yamlToJson(yamlStr);
      expect(back).toEqual(obj);
    });
  });
});
