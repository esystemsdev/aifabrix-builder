/**
 * Logger Utility
 *
 * Centralized logging utility that wraps console methods
 * Allows disabling eslint warnings in one place
 *
 * @fileoverview Logger utility for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/* eslint-disable no-console */

/**
 * Logger utility that wraps console methods
 * All console statements should use this logger to avoid eslint warnings
 */
const logger = {
  /**
   * Log informational message
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    console.log(...args);
  },

  /**
   * Log error message
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Log warning message
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Log informational message (alias for log)
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    console.log(...args);
  }
};

module.exports = logger;

