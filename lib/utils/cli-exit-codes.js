/**
 * Canonical Builder CLI exit codes for scriptable commands.
 *
 * Documented in `docs/commands/authentication.md`. Use in
 * `aifabrix auth status --validate` and any future `--validate`-style flag.
 *
 * @fileoverview Exit-code constants for scriptable Builder CLI commands
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/** Success. */
const EXIT_OK = 0;

/** Not authenticated / invalid token. */
const EXIT_NOT_AUTHENTICATED = 1;

/**
 * Authenticated but installed Builder CLI version is older than the dataplane
 * minimum advertised by `GET /api/v1/health → minBuilderCliVersion` (plan 403.0).
 */
const EXIT_CLI_VERSION_INCOMPATIBLE = 3;

module.exports = {
  EXIT_OK,
  EXIT_NOT_AUTHENTICATED,
  EXIT_CLI_VERSION_INCOMPATIBLE
};
