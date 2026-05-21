/**
 * @fileoverview Help-after strings for setup-utility CLI commands.
 */

'use strict';

const JSON_HELP_AFTER = `
Example:
  $ aifabrix json myapp
Generates *-deploy.json (or application-schema.json) for commit before deploy.
`;

const VALIDATE_HELP_AFTER = `
Examples:
  $ aifabrix validate myapp
  $ aifabrix validate myapp --cert-sync
  $ aifabrix validate --integration
  $ aifabrix validate --builder
`;

const REPAIR_HELP_AFTER = `
Examples:
  $ aifabrix repair hubspot-demo
    Align manifest, system/datasource files, RBAC extract, env.template, and deploy JSON under integration/<systemKey>/.

  $ aifabrix repair hubspot-demo --dry-run
    Show what would change without writing files.

  $ aifabrix repair hubspot-demo --auth bearerKey
    Private-app style apikey: Authorization + Bearer prefix; preserves baseUrl/testEndpoint when present. Warns if testEndpoint is missing.

  $ aifabrix repair hubspot-demo --auth oauth2
    Set authentication method; updates the system file and env.template (oauth2, aad, apikey, bearerKey, basic, …).

  $ aifabrix repair hubspot-demo --rbac --expose --sync --test
    Optional datasource fixes: RBAC roles/permissions, exposed.schema from attributes, default sync block, testPayload stubs.

  $ aifabrix repair hubspot-demo --doc
    Regenerate README.md from the current deployment manifest only (other drift fixes unchanged).

  Before overwriting files, repair writes timestamped backups under integration/<systemKey>/backup/ (same as datasource capability copy). Use --no-backup to skip.
`;

module.exports = {
  JSON_HELP_AFTER,
  VALIDATE_HELP_AFTER,
  REPAIR_HELP_AFTER
};
