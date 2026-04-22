/**
 * Docker CLI exec with dev-config remote Docker (docker-endpoint + TLS) applied.
 *
 * @fileoverview Wraps child_process.exec with getDockerExecEnv for consistent remote daemon use
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

/**
 * Run a shell command with process.env merged with remote Docker client settings when docker-endpoint is set.
 * @param {string} command
 * @param {import('child_process').ExecOptions} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
async function execWithDockerEnv(command, options = {}) {
  const { getDockerExecEnv } = require('./remote-docker-env');
  const env = { ...(await getDockerExecEnv()), ...(options.env || {}) };
  return execAsync(command, { ...options, env });
}

module.exports = { execWithDockerEnv };
