/**
 * Environment File Reader and Converter Module
 * 
 * Handles reading existing .env files and converting them to templates
 * following ISO 27001 security standards for sensitive data handling
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Read existing .env file from application folder
 * @param {string} appPath - Path to application directory
 * @returns {Promise<Object|null>} Parsed environment variables or null if not found
 */
async function readExistingEnv(appPath) {
  const envPath = path.join(appPath, '.env');
  
  try {
    await fs.access(envPath);
    const content = await fs.readFile(envPath, 'utf8');
    return parseEnvContent(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to read .env file: ${error.message}`);
  }
}

/**
 * Parse .env file content into key-value pairs
 * @param {string} content - Raw .env file content
 * @returns {Object} Parsed environment variables
 */
function parseEnvContent(content) {
  const envVars = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }
    
    // Parse key=value pairs
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }
    
    const key = trimmedLine.substring(0, equalIndex).trim();
    let value = trimmedLine.substring(equalIndex + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    envVars[key] = value;
  }
  
  return envVars;
}

/**
 * Determine if a value should be converted to kv:// reference
 * @param {string} key - Environment variable key
 * @param {string} value - Environment variable value
 * @returns {boolean} True if value should be treated as sensitive
 */
function detectSensitiveValue(key, value) {
  // Check key patterns for sensitive data
  const sensitiveKeyPatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /api[_-]?key/i,
    /private/i,
    /auth/i,
    /credential/i,
    /passwd/i,
    /pwd/i
  ];
  
  for (const pattern of sensitiveKeyPatterns) {
    if (pattern.test(key)) {
      return true;
    }
  }
  
  // Check value patterns for sensitive data
  const sensitiveValuePatterns = [
    // UUIDs (8-4-4-4-12 format)
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    // Long random strings (>32 characters)
    /^[a-zA-Z0-9+/=]{32,}$/,
    // JWT tokens (three base64 parts separated by dots)
    /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
    // Hex strings (>16 characters)
    /^[0-9a-f]{16,}$/i
  ];
  
  for (const pattern of sensitiveValuePatterns) {
    if (pattern.test(value)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Convert existing .env variables to env.template format
 * @param {Object} existingEnv - Existing environment variables
 * @param {Object} requiredVars - Required variables for the application
 * @returns {Object} Merged environment variables with sensitive values converted
 */
function convertToEnvTemplate(existingEnv, requiredVars) {
  const convertedEnv = { ...requiredVars };
  
  // Process existing environment variables
  Object.entries(existingEnv).forEach(([key, value]) => {
    if (detectSensitiveValue(key, value)) {
      // Convert sensitive values to kv:// references
      convertedEnv[key] = `kv://${key.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    } else {
      // Keep non-sensitive values as-is
      convertedEnv[key] = value;
    }
  });
  
  return convertedEnv;
}

/**
 * Extract sensitive values for secrets.yaml generation
 * @param {Object} envVars - Environment variables
 * @returns {Object} Object suitable for secrets.yaml
 */
function generateSecretsFromEnv(envVars) {
  const secrets = {};
  
  Object.entries(envVars).forEach(([key, value]) => {
    if (detectSensitiveValue(key, value)) {
      // Convert key to secret name format
      const secretName = key.toLowerCase().replace(/[^a-z0-9]/g, '-');
      secrets[secretName] = value;
    }
  });
  
  return secrets;
}

/**
 * Validate environment variable names
 * @param {string} key - Environment variable key
 * @returns {boolean} True if key is valid
 */
function validateEnvKey(key) {
  // Environment variable names should be uppercase letters, numbers, and underscores
  return /^[A-Z][A-Z0-9_]*$/.test(key);
}

/**
 * Sanitize environment variable value
 * @param {string} value - Environment variable value
 * @returns {string} Sanitized value
 */
function sanitizeEnvValue(value) {
  // Remove any potential injection characters
  return value.replace(/[;\r\n]/g, '');
}

/**
 * Generate environment template with security considerations
 * @param {Object} config - Application configuration
 * @param {Object} existingEnv - Existing environment variables
 * @returns {Promise<Object>} Template generation result
 */
async function generateEnvTemplate(config, existingEnv = {}) {
  const result = {
    template: '',
    secrets: {},
    warnings: []
  };
  
  try {
    // Convert existing environment variables
    const convertedEnv = convertToEnvTemplate(existingEnv, {});
    
    // Extract secrets for secrets.yaml
    result.secrets = generateSecretsFromEnv(existingEnv);
    
    // Validate environment variables
    Object.entries(existingEnv).forEach(([key, value]) => {
      if (!validateEnvKey(key)) {
        result.warnings.push(`Invalid environment variable name: ${key}`);
      }
      
      const sanitizedValue = sanitizeEnvValue(value);
      if (sanitizedValue !== value) {
        result.warnings.push(`Sanitized value for ${key} (removed special characters)`);
      }
    });
    
    // Generate template content
    const { generateEnvTemplate: generateTemplate } = require('./templates');
    const baseTemplate = generateTemplate(config);
    
    // Add existing environment variables to the template
    const existingEnvSection = [];
    Object.entries(convertedEnv).forEach(([key, value]) => {
      if (!key.startsWith('NODE_ENV') && !key.startsWith('PORT') && 
          !key.startsWith('APP_NAME') && !key.startsWith('LOG_LEVEL') &&
          !key.startsWith('DB_') && !key.startsWith('DATABASE_') &&
          !key.startsWith('REDIS_') && !key.startsWith('STORAGE_') &&
          !key.startsWith('JWT_') && !key.startsWith('AUTH_') && 
          !key.startsWith('SESSION_')) {
        existingEnvSection.push(`${key}=${value}`);
      }
    });
    
    if (existingEnvSection.length > 0) {
      result.template = baseTemplate + '\n\n# Existing Environment Variables\n' + existingEnvSection.join('\n');
    } else {
      result.template = baseTemplate;
    }
    
  } catch (error) {
    throw new Error(`Failed to generate environment template: ${error.message}`);
  }
  
  return result;
}

module.exports = {
  readExistingEnv,
  parseEnvContent,
  detectSensitiveValue,
  convertToEnvTemplate,
  generateSecretsFromEnv,
  validateEnvKey,
  sanitizeEnvValue,
  generateEnvTemplate
};
