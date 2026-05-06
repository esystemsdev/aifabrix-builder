/**
 * CLI integration-client command setup (Controller OAuth / API clients).
 *
 * @fileoverview Integration client CLI definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');
const {
  runIntegrationClientCreate,
  runIntegrationClientList,
  runIntegrationClientRotateSecret,
  runIntegrationClientDelete,
  runIntegrationClientUpdateGroups,
  runIntegrationClientUpdateRedirectUris
} = require('../commands/integration-client');

const HELP_AFTER = `
Integration clients are machine identities for integrations, CI, Postman OAuth2, or API access.
Use: list (integration-client:read), create (integration-client:create), rotate-secret,
update-groups, update-redirect-uris (integration-client:update), delete (integration-client:delete).
The controller returns a one-time clientSecret on create and rotate-secret—save it immediately;
it cannot be retrieved again.

Examples:
  $ aifabrix integration-client create --key postman --display-name "Postman client" \\
      --redirect-uris https://oauth.pstmn.io/v1/callback --group-names AI-Fabrix-Platform-Admins
  $ aifabrix integration-client list
  $ aifabrix integration-client rotate-secret --id <uuid>
  $ aifabrix integration-client delete --id <uuid>
  $ aifabrix integration-client update-groups --id <uuid> --group-names Group1,Group2
  $ aifabrix integration-client update-redirect-uris --id <uuid> --redirect-uris https://app.example.com/callback

Run "aifabrix login" first.`;

function parseOptionalInt(val) {
  return (val !== undefined && val !== null) ? parseInt(val, 10) : undefined;
}

function addCreateCommand(integrationClient) {
  integrationClient.command('create')
    .description('Create an integration client and receive a one-time clientSecret (save it now; it will not be shown again)')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('-k, --key <key>', 'Stable key (lowercase alphanumeric and hyphens; required)')
    .option('-n, --display-name <name>', 'Display name (required)')
    .option('--keycloak-client-id <id>', 'Optional fixed Keycloak client id (when omitted, the server assigns one)')
    .option('--redirect-uris <uris>', 'Comma-separated OAuth2 redirect URIs (required)')
    .option('--group-names <names>', 'Comma-separated group names (optional; omit for OAuth-only clients)')
    .option('-d, --description <description>', 'Optional description')
    .action(async(options) => {
      try {
        await runIntegrationClientCreate({
          controller: options.controller,
          key: options.key,
          displayName: options.displayName,
          keycloakClientId: options.keycloakClientId,
          redirectUris: options.redirectUris,
          groupNames: options.groupNames,
          description: options.description
        });
      } catch (error) {
        handleCommandError(error, 'integration-client create');
        process.exit(1);
      }
    });
}

function addListCommand(integrationClient) {
  integrationClient.command('list')
    .description('List integration clients (supports pagination and search)')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--page <n>', 'Page number')
    .option('--page-size <n>', 'Items per page')
    .option('--search <term>', 'Search term')
    .option('--sort <field>', 'Sort field/direction')
    .option('--filter <expr>', 'Filter expression')
    .action(async(options) => {
      try {
        await runIntegrationClientList({
          controller: options.controller,
          page: parseOptionalInt(options.page),
          pageSize: parseOptionalInt(options.pageSize),
          search: options.search,
          sort: options.sort,
          filter: options.filter
        });
      } catch (error) {
        handleCommandError(error, 'integration-client list');
        process.exit(1);
      }
    });
}

function addRotateSecretCommand(integrationClient) {
  integrationClient.command('rotate-secret')
    .description('Rotate (regenerate) secret for an integration client; new secret shown once only')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Integration client ID (required)')
    .action(async(options) => {
      try {
        await runIntegrationClientRotateSecret({ controller: options.controller, id: options.id });
      } catch (error) {
        handleCommandError(error, 'integration-client rotate-secret');
        process.exit(1);
      }
    });
}

function addDeleteCommand(integrationClient) {
  integrationClient.command('delete')
    .description('Delete (deactivate) an integration client')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Integration client ID (required)')
    .action(async(options) => {
      try {
        await runIntegrationClientDelete({ controller: options.controller, id: options.id });
      } catch (error) {
        handleCommandError(error, 'integration-client delete');
        process.exit(1);
      }
    });
}

function addUpdateGroupsCommand(integrationClient) {
  integrationClient.command('update-groups')
    .description('Update group assignments for an integration client')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Integration client ID (required)')
    .option('--group-names <names>', 'Comma-separated group names (required)')
    .action(async(options) => {
      try {
        await runIntegrationClientUpdateGroups({
          controller: options.controller,
          id: options.id,
          groupNames: options.groupNames
        });
      } catch (error) {
        handleCommandError(error, 'integration-client update-groups');
        process.exit(1);
      }
    });
}

function addUpdateRedirectUrisCommand(integrationClient) {
  integrationClient.command('update-redirect-uris')
    .description('Update redirect URIs for an integration client (min 1)')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Integration client ID (required)')
    .option('--redirect-uris <uris>', 'Comma-separated redirect URIs (required, min 1)')
    .action(async(options) => {
      try {
        await runIntegrationClientUpdateRedirectUris({
          controller: options.controller,
          id: options.id,
          redirectUris: options.redirectUris
        });
      } catch (error) {
        handleCommandError(error, 'integration-client update-redirect-uris');
        process.exit(1);
      }
    });
}

/**
 * Registers integration-client commands
 * @param {Command} program - Commander program instance
 */
function setupIntegrationClientCommands(program) {
  const integrationClient = program
    .command('integration-client')
    .description('OAuth integration clients on Controller (integrations, CI, API access)')
    .addHelpText('after', HELP_AFTER);
  addCreateCommand(integrationClient);
  addListCommand(integrationClient);
  addRotateSecretCommand(integrationClient);
  addDeleteCommand(integrationClient);
  addUpdateGroupsCommand(integrationClient);
  addUpdateRedirectUrisCommand(integrationClient);
}

module.exports = { setupIntegrationClientCommands };
