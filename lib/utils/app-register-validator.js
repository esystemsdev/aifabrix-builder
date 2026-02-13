/**
 * AI Fabrix Builder - App Register Validation Utilities
 *
 * Validation logic for application registration
 *
 * @fileoverview Validation utilities for app registration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('./logger');
const { detectAppType } = require('./paths');
const applicationSchema = require('../schema/application-schema.json');

// Extract valid enum values from application schema
const validTypes = applicationSchema.properties.type.enum || [];
const validRegistryModes = applicationSchema.properties.registryMode.enum || [];
const portConstraints = {
  minimum: applicationSchema.properties.port?.minimum || 1,
  maximum: applicationSchema.properties.port?.maximum || 65535
};
const imagePattern = applicationSchema.properties.image?.pattern || /^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._-]+$/;

/**
 * Validation schema for application registration
 * Validates according to application-schema.json
 */
const registerApplicationSchema = {
  environmentId: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Invalid environment ID format');
    }
    return val;
  },
  key: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Application key is required');
    }
    const keyPattern = applicationSchema.properties.key.pattern;
    const keyMaxLength = applicationSchema.properties.key.maxLength || 50;
    if (val.length > keyMaxLength) {
      throw new Error(`Application key must be at most ${keyMaxLength} characters`);
    }
    if (keyPattern && !new RegExp(keyPattern).test(val)) {
      throw new Error('Application key must contain only lowercase letters, numbers, and hyphens');
    }
    return val;
  },
  displayName: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Display name is required');
    }
    const displayNameMaxLength = applicationSchema.properties.displayName.maxLength || 100;
    if (val.length > displayNameMaxLength) {
      throw new Error(`Display name must be at most ${displayNameMaxLength} characters`);
    }
    return val;
  },
  description: (val) => val || undefined,
  image: (val, appType) => {
    // Image is required for non-external types
    if (appType !== 'external') {
      if (!val || typeof val !== 'string') {
        throw new Error('Image is required for non-external application types');
      }
      // Validate image format: repository:tag
      const pattern = typeof imagePattern === 'string' ? new RegExp(imagePattern) : imagePattern;
      if (!pattern.test(val)) {
        throw new Error('Image must be in format repository:tag (e.g., aifabrix/miso-controller:latest or myregistry.azurecr.io/miso-controller:v1.0.0)');
      }
    }
    return val || undefined;
  },
  configuration: (val) => {
    if (!val || !val.type || !validTypes.includes(val.type)) {
      throw new Error(`Configuration type must be one of: ${validTypes.join(', ')}`);
    }

    // For external type: require externalIntegration, skip registryMode/port validation
    if (val.type === 'external') {
      if (!val.externalIntegration) {
        throw new Error('externalIntegration is required for external application type');
      }
      // External type should not have registryMode, port, or image
      return val;
    }

    // For non-external types: require registryMode, port, image
    if (!val.registryMode || !validRegistryModes.includes(val.registryMode)) {
      throw new Error(`Registry mode must be one of: ${validRegistryModes.join(', ')}`);
    }
    if (val.port === undefined || val.port === null) {
      throw new Error('Port is required for non-external application types');
    }
    if (!Number.isInteger(val.port) || val.port < portConstraints.minimum || val.port > portConstraints.maximum) {
      throw new Error(`Port must be an integer between ${portConstraints.minimum} and ${portConstraints.maximum}`);
    }
    return val;
  }
};

/**
 * Validate application registration data
 * @async
 * @param {Object} config - Application configuration
 * @param {string} originalAppKey - Original app key for error messages
 * @throws {Error} If validation fails
 */
async function validateAppRegistrationData(config, originalAppKey) {
  const missingFields = [];
  if (!config.appKey) missingFields.push('app.key');
  if (!config.displayName) missingFields.push('app.name');

  if (missingFields.length > 0) {
    logger.error(chalk.red('❌ Missing required fields in application.yaml:'));
    missingFields.forEach(field => logger.error(chalk.red(`   - ${field}`)));
    // Detect app type to show correct path
    const { appPath } = await detectAppType(originalAppKey);
    const relativePath = path.relative(process.cwd(), appPath);
    logger.error(chalk.red(`\n   Please update ${relativePath}/application.yaml and try again.`));
    process.exit(1);
  }

  try {
    registerApplicationSchema.key(config.appKey);
    registerApplicationSchema.displayName(config.displayName);
    registerApplicationSchema.image(config.image, config.appType);
    registerApplicationSchema.configuration({
      type: config.appType,
      registryMode: config.registryMode,
      port: config.port,
      externalIntegration: config.externalIntegration
    });
  } catch (error) {
    logger.error(chalk.red(`❌ Invalid configuration: ${error.message}`));
    process.exit(1);
  }
}

module.exports = { registerApplicationSchema, validateAppRegistrationData };

