/**
 * Test Helper Utilities for Dataplane Down Tests
 *
 * Common utilities for dataplane down test suite.
 *
 * @fileoverview Helper utilities for dataplane down tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */
'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 15 * 1000; // 15 seconds - shorter timeout to catch hanging commands

/**
 * Logs info message
 * @function logInfo
 * @param {string} message - Message to log
 * @returns {void}
 */
function logInfo(message) {
  // eslint-disable-next-line no-console
  console.log(chalk.cyan(message));
}

/**
 * Logs success message
 * @function logSuccess
 * @param {string} message - Message to log
 * @returns {void}
 */
function logSuccess(message) {
  // eslint-disable-next-line no-console
  console.log(chalk.green(message));
}

/**
 * Logs error message
 * @function logError
 * @param {string} message - Message to log
 * @returns {void}
 */
function logError(message) {
  // eslint-disable-next-line no-console
  console.error(chalk.red(message));
}

/**
 * Logs warning message
 * @function logWarn
 * @param {string} message - Message to log
 * @returns {void}
 */
function logWarn(message) {
  // eslint-disable-next-line no-console
  console.warn(chalk.yellow(message));
}

/**
 * Runs a command
 * @async
 * @function runCommand
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @returns {Promise<Object>} Command result object with success, stdout, stderr
 */
async function runCommand(command, args) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: MAX_OUTPUT_BYTES,
      timeout: COMMAND_TIMEOUT_MS
    });
    return { success: true, stdout: result.stdout || '', stderr: result.stderr || '', error: null };
  } catch (error) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    // Check if it's a timeout error
    const isTimeout = error.code === 'ETIMEDOUT' ||
                     (error.message && error.message.includes('timeout'));
    return { success: false, stdout, stderr, error, isTimeout };
  }
}

/**
 * Validates error message contains expected patterns
 * @function validateError
 * @param {string} output - Combined stdout and stderr
 * @param {string[]} expectedPatterns - Array of expected error patterns
 * @returns {boolean} True if error matches expected patterns
 */
function validateError(output, expectedPatterns) {
  const lowerOutput = output.toLowerCase();
  return expectedPatterns.some(pattern => lowerOutput.includes(pattern.toLowerCase()));
}

/**
 * Checks if result indicates a timeout
 * @function isTimeoutResult
 * @param {Object} result - Command result
 * @returns {boolean} True if timeout detected
 */
function isTimeoutResult(result) {
  return result.isTimeout || (result.error && (
    result.error.code === 'ETIMEDOUT' ||
    (result.error.message && result.error.message.includes('timeout'))
  ));
}

/**
 * Checks if output contains error indicators
 * @function hasErrorIndicators
 * @param {string} output - Combined output
 * @param {string[]} expectedPatterns - Expected error patterns
 * @param {Object} result - Command result
 * @returns {boolean} True if error indicators found
 */
function hasErrorIndicators(output, expectedPatterns, result) {
  return validateError(output, expectedPatterns) ||
    output.includes('Failed') ||
    output.includes('Error') ||
    output.includes('not found') ||
    output.includes('External system') ||
    output.includes('external system') ||
    output.includes('timeout') ||
    output.includes('ECONNREFUSED') ||
    output.includes('ENOTFOUND') ||
    output.includes('Command failed') ||
    (result.error && result.error.message) ||
    result.stderr.length > 0;
}

/**
 * Validates download/delete command result
 * @function validateDownloadDeleteResult
 * @param {Object} result - Command result
 * @param {string} output - Combined output
 * @param {string[]} expectedPatterns - Expected error patterns
 * @returns {Object} Validation result
 */
function validateDownloadDeleteResult(result, output, expectedPatterns) {
  const timeout = isTimeoutResult(result);
  const isValid = (!result.success || timeout) && (
    timeout ||
    validateError(output, expectedPatterns) ||
    output.includes('Failed') ||
    output.includes('Error')
  );

  return {
    isValid,
    timeout,
    output: timeout ? `${output}\n[Command timed out - this indicates the command may be hanging]` : output,
    expectedPatterns: timeout ? [...expectedPatterns, 'timeout'] : expectedPatterns
  };
}

/**
 * Validates delete command result
 * @function validateDeleteResult
 * @param {Object} result - Command result
 * @param {string} output - Combined output
 * @param {string[]} expectedPatterns - Expected error patterns
 * @returns {Object} Validation result
 */
function validateDeleteResult(result, output, expectedPatterns) {
  const timeout = isTimeoutResult(result);

  if (result.success && !timeout) {
    return {
      isValid: false,
      output: `Command succeeded when it should have failed. Output: ${output.substring(0, 200)}`,
      expectedPatterns,
      error: 'Command should have failed but succeeded'
    };
  }

  const hasErrorIndicator = timeout || hasErrorIndicators(output, expectedPatterns, result);
  const isValid = (!result.success || timeout) && (
    timeout ||
    hasErrorIndicator ||
    result.error !== null
  );

  const fullOutput = timeout
    ? `${output}\n[Command timed out after ${COMMAND_TIMEOUT_MS}ms - this indicates the command may be hanging when dataplane is down]`
    : output;

  return {
    isValid,
    output: fullOutput,
    expectedPatterns: timeout ? [...expectedPatterns, 'timeout'] : expectedPatterns,
    error: result.error ? (result.error.message || String(result.error)) : undefined
  };
}

/**
 * Validates wizard command result
 * @function validateWizardResult
 * @param {Object} result - Command result
 * @param {string} output - Combined output
 * @returns {Object} Validation result
 */
function validateWizardResult(result, output) {
  const expectedPatterns = [
    'failed to connect',
    'connection refused',
    'network error',
    'econnrefused',
    'fetch failed',
    'timeout',
    'unreachable',
    'failed to create wizard session',
    'authentication failed',
    'no authentication method',
    'client token unavailable'
  ];

  const isValid = !result.success && validateError(output, expectedPatterns);

  return {
    name: 'wizard',
    success: isValid,
    output,
    expectedPatterns
  };
}

module.exports = {
  logInfo,
  logSuccess,
  logError,
  logWarn,
  runCommand,
  validateError,
  isTimeoutResult,
  hasErrorIndicators,
  validateDownloadDeleteResult,
  validateDeleteResult,
  validateWizardResult,
  COMMAND_TIMEOUT_MS
};
