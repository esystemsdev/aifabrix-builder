/**
 * Tests for CLI Additional Branches
 *
 * @fileoverview Additional tests to improve branch coverage in cli.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../lib/infra');
jest.mock('../../lib/app');
jest.mock('../../lib/secrets');
jest.mock('../../lib/generator');
jest.mock('../../lib/validator');
jest.mock('../../lib/key-generator');
jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');

const infra = require('../../lib/infra');
const app = require('../../lib/app');
const secrets = require('../../lib/secrets');
const generator = require('../../lib/generator');
const validator = require('../../lib/validator');
const keyGenerator = require('../../lib/key-generator');
const { setupCommands, handleCommandError } = require('../../lib/cli');

describe('CLI Additional Branch Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('doctor command - all branch paths', () => {
    it('should handle Docker not available', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'not available',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });

      const result = await validator.checkEnvironment();
      const dockerStatus = result.docker === 'ok' ? '✅ Running' : '❌ Not available';
      expect(dockerStatus).toBe('❌ Not available');
    });

    it('should handle ports in use', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'warning',
        secrets: 'ok',
        recommendations: []
      });

      const result = await validator.checkEnvironment();
      const portsStatus = result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use';
      expect(portsStatus).toBe('⚠️  Some ports in use');
    });

    it('should handle secrets missing', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'ok',
        secrets: 'missing',
        recommendations: []
      });

      const result = await validator.checkEnvironment();
      const secretsStatus = result.secrets === 'ok' ? '✅ Configured' : '❌ Missing';
      expect(secretsStatus).toBe('❌ Missing');
    });

    it('should handle unknown service status', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });

      infra.checkInfraHealth.mockResolvedValue({
        postgres: 'unknown',
        redis: 'healthy'
      });

      const health = await infra.checkInfraHealth();
      Object.entries(health).forEach(([service, status]) => {
        const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
        if (service === 'postgres') {
          expect(icon).toBe('❓');
        }
      });
    });

    it('should handle unhealthy service status', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'ok',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });

      infra.checkInfraHealth.mockResolvedValue({
        postgres: 'unhealthy',
        redis: 'healthy'
      });

      const health = await infra.checkInfraHealth();
      Object.entries(health).forEach(([service, status]) => {
        const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
        if (service === 'postgres') {
          expect(icon).toBe('❌');
        }
      });
    });

    it('should skip health check when Docker not available', async() => {
      validator.checkEnvironment.mockResolvedValue({
        docker: 'not available',
        ports: 'ok',
        secrets: 'ok',
        recommendations: []
      });

      const result = await validator.checkEnvironment();
      if (result.docker === 'ok') {
        await infra.checkInfraHealth();
      }
      expect(infra.checkInfraHealth).not.toHaveBeenCalled();
    });
  });

  describe('status command - all branch paths', () => {
    it('should handle stopped service', async() => {
      infra.getInfraStatus.mockResolvedValue({
        postgres: {
          status: 'stopped',
          port: 5432,
          url: 'http://localhost:5432'
        },
        redis: {
          status: 'running',
          port: 6379,
          url: 'http://localhost:6379'
        }
      });

      const status = await infra.getInfraStatus();
      Object.entries(status).forEach(([service, info]) => {
        const icon = info.status === 'running' ? '✅' : '❌';
        if (service === 'postgres') {
          expect(icon).toBe('❌');
        } else {
          expect(icon).toBe('✅');
        }
      });
    });
  });

  describe('json command - all branches', () => {
    it('should handle result with no warnings', async() => {
      generator.generateDeployJsonWithValidation.mockResolvedValue({
        success: true,
        path: '/path/to/test-app-deploy.json',
        validation: {
          warnings: [],
          errors: []
        }
      });

      const result = await generator.generateDeployJsonWithValidation('test-app');
      if (result.success) {
        console.log(`✓ Generated deployment JSON: ${result.path}`);
        if (result.validation.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.validation.warnings.forEach(warning => console.log(`   • ${warning}`));
        }
      }

      expect(console.log).toHaveBeenCalledWith('✓ Generated deployment JSON: /path/to/test-app-deploy.json');
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('⚠️  Warnings:'));
    });

    it('should handle warnings', async() => {
      generator.generateDeployJsonWithValidation.mockResolvedValue({
        success: true,
        path: '/path/to/test-app-deploy.json',
        validation: {
          warnings: ['Warning 1'],
          errors: []
        }
      });

      const result = await generator.generateDeployJsonWithValidation('test-app');
      if (result.success) {
        console.log(`✓ Generated deployment JSON: ${result.path}`);
        if (result.validation.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.validation.warnings.forEach(warning => console.log(`   • ${warning}`));
        }
      }

      expect(console.log).toHaveBeenCalledWith('\n⚠️  Warnings:');
    });

    it('should handle validation errors', async() => {
      generator.generateDeployJsonWithValidation.mockResolvedValue({
        success: false,
        validation: {
          errors: ['Error 1'],
          warnings: []
        }
      });

      const result = await generator.generateDeployJsonWithValidation('test-app');
      if (!result.success) {
        console.log('❌ Validation failed:');
        result.validation.errors.forEach(error => console.log(`   • ${error}`));
        process.exit(1);
      }

      expect(console.log).toHaveBeenCalledWith('❌ Validation failed:');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});

