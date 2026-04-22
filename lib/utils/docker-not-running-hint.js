/**
 * @fileoverview Platform-specific hints when the Docker CLI cannot reach the daemon.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * Short sentence: how to get a working Docker daemon for this OS (no trailing period in fragment use).
 * @returns {string}
 */
function getDockerDaemonStartHintSentence() {
  if (process.platform === 'linux') {
    return (
      'Start the Docker daemon (e.g. sudo systemctl start docker), install Docker Engine if needed, ' +
      'and ensure your user can use the socket (e.g. sudo usermod -aG docker $USER, then log out and back in). ' +
      'On Windows or macOS, start Docker Desktop.'
    );
  }
  if (process.platform === 'darwin') {
    return 'Start Docker Desktop (or Colima / another runtime) and try again.';
  }
  return 'Start Docker Desktop and try again.';
}

/**
 * Single-line error for thrown Error.message (build spawn failures, etc.).
 * @returns {string}
 */
function getDockerNotRunningErrorMessage() {
  return `Docker is not running or not installed. ${getDockerDaemonStartHintSentence()}`;
}

/**
 * When the user cannot use the local unix socket (no docker group) but Docker runs on the same or another host
 * exposing the Engine API — the CLI talks to that API via DOCKER_HOST (docker-endpoint in ~/.aifabrix/config.yaml).
 * @returns {string[]}
 */
function getDockerApiOverTcpHintLines() {
  return [
    '   Without unix socket access: set docker-endpoint to the Docker Engine API (e.g. tcp://builder02.local:2376). Builder settings often merge this after aifabrix dev init or dev refresh.',
    '   The CLI still runs docker/docker compose locally as a thin client to that API (not the Builder HTTP API). TLS: cert.pem, key.pem, ca.pem in ~/.aifabrix/certs/<developer-id>/ (match daemon client-auth).',
    '   Run: aifabrix dev show'
  ];
}

module.exports = {
  getDockerDaemonStartHintSentence,
  getDockerNotRunningErrorMessage,
  getDockerApiOverTcpHintLines
};
