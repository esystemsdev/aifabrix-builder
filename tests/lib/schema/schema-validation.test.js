/**
 * Schema validation tests (Plan 49 – Controller-owned deployment key)
 *
 * Validates that all schemas parse as valid JSON, compile with AJV,
 * and that the central mapping (deployment-rules.yaml) has the expected structure.
 *
 * @fileoverview Schema validation for application, external-system, external-datasource, infrastructure
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');

// Resolve schema dir: __dirname is tests/lib/schema, so project root is 3 levels up
const schemaDir = path.resolve(__dirname, '..', '..', '..', 'lib', 'schema');

describe('Schema validation (Plan 49)', () => {
  const schemas = [
    { name: 'application', file: 'application-schema.json' },
    { name: 'external-system', file: 'external-system.schema.json' },
    { name: 'external-datasource', file: 'external-datasource.schema.json' },
    { name: 'infrastructure', file: 'infrastructure-schema.json' }
  ];

  describe('JSON validity', () => {
    schemas.forEach(({ name, file }) => {
      it(`should parse ${name} schema as valid JSON`, () => {
        const schemaPath = path.join(schemaDir, file);
        expect(fs.existsSync(schemaPath)).toBe(true);
        const content = fs.readFileSync(schemaPath, 'utf8');
        expect(() => JSON.parse(content)).not.toThrow();
        const parsed = JSON.parse(content);
        expect(parsed).toBeDefined();
        expect(typeof parsed).toBe('object');
      });
    });
  });

  describe('JSON Schema validity (AJV compilation)', () => {
    it('should validate deployment via validator (schema compiles with $ref resolution)', () => {
      const validator = require('../../../lib/validation/validator');
      const deployment = {
        key: 'testapp',
        displayName: 'Test App',
        description: 'A test application',
        type: 'webapp',
        image: 'myacr.azurecr.io/testapp:v1.0.0',
        registryMode: 'acr',
        port: 3000,
        deploymentKey: '0000000000000000000000000000000000000000000000000000000000000000',
        requiresDatabase: true,
        databases: [{ name: 'testapp' }],
        configuration: []
      };
      const result = validator.validateDeploymentJson(deployment);
      expect(result.valid).toBe(true);
    });

    it('should compile external-system schema with AJV', () => {
      const externalSystemSchema = require('../../../lib/schema/external-system.schema.json');
      const ajv = new Ajv({ allErrors: true, strict: false });
      expect(() => ajv.compile(externalSystemSchema)).not.toThrow();
    });

    it('should compile external-datasource schema with AJV', () => {
      const externalDatasourceSchema = require('../../../lib/schema/external-datasource.schema.json');
      const schemaCopy = { ...externalDatasourceSchema };
      if (schemaCopy.$schema && schemaCopy.$schema.includes('2020-12')) {
        delete schemaCopy.$schema;
      }
      const ajv = new Ajv({ allErrors: true, strict: false });
      expect(() => ajv.compile(schemaCopy)).not.toThrow();
    });

    it('should compile infrastructure schema with AJV', () => {
      const infrastructureSchema = require('../../../lib/schema/infrastructure-schema.json');
      const ajv = new Ajv({ allErrors: true, strict: false });
      expect(() => ajv.compile(infrastructureSchema)).not.toThrow();
    });
  });

  describe('Central mapping (deployment-rules.yaml)', () => {
    let deploymentRules;

    beforeAll(() => {
      const yaml = require('js-yaml');
      const rulesPath = path.join(schemaDir, 'deployment-rules.yaml');
      expect(fs.existsSync(rulesPath)).toBe(true);
      const content = fs.readFileSync(rulesPath, 'utf8');
      deploymentRules = yaml.load(content);
    });

    it('should have application, externalSystem, externalDataSource sections', () => {
      expect(deploymentRules.application).toBeDefined();
      expect(deploymentRules.externalSystem).toBeDefined();
      expect(deploymentRules.externalDataSource).toBeDefined();
    });

    it('should have triggerPaths and overridablePaths per schema', () => {
      ['application', 'externalSystem', 'externalDataSource'].forEach(schema => {
        expect(Array.isArray(deploymentRules[schema].triggerPaths)).toBe(true);
        expect(Array.isArray(deploymentRules[schema].overridablePaths)).toBe(true);
        expect(deploymentRules[schema].triggerPaths.length).toBeGreaterThan(0);
      });
    });

    it('should have configuration.items.value in application overridablePaths', () => {
      expect(deploymentRules.application.overridablePaths).toContain('configuration.items.value');
    });

    it('should have key in application triggerPaths', () => {
      expect(deploymentRules.application.triggerPaths).toContain('key');
    });

    it('should have credentialIdOrKey in externalSystem overridablePaths', () => {
      expect(deploymentRules.externalSystem.overridablePaths).toContain('credentialIdOrKey');
    });

    it('should have sync in externalDataSource overridablePaths', () => {
      expect(deploymentRules.externalDataSource.overridablePaths).toContain('sync');
    });
  });
});
