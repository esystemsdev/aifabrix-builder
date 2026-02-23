**Key Vault Architecture:**

- **Shared Key Vault**: One Key Vault supports multiple applications
- **Infrastructure Level Parameters**: Shared across all apps (e.g., `smtp.host` → `smtp-host`, `redis.urlKeyVault` → `redis-urlKeyVault`)
- **Application Level Parameters**: App-specific parameters (e.g., `secrets.sessionKeyVault` → `{app-key}-secrets-sessionKeyVault`)
- **Automatic Prefixing**: The `{app-key}` prefix is added automatically by the system during installation

| Parameter Type                 | Field Name                             | Location/Value | Description                    | Key Vault Name                                 |
| ------------------------------ | -------------------------------------- | -------------- | ------------------------------ | ---------------------------------------------- |
| **Database Configuration**     |                                        |                |                                |                                                |
| Database URL                   | `databases[i].urlKeyVault`             | `keyvault`     | Connection string secret name  | `{app-key}-databases-{index}-urlKeyVault`      |
| Database Username              | `databases[i].username`                | `variable`     | Database user account          | `none`                                         |
| Database name                  | `databases[i].name`                    | `variable`     | Database name                  | `none`                                         |
| Database Password              | `databases[i].passwordKeyVault`        | `keyvault`     | Password secret (auto16)       | `{app-key}-databases-{index}-passwordKeyVault` |
| **Redis Configuration**        |                                        |                |                                |                                                |
| Redis URL                      | `redis.urlKeyVault`                    | `keyvault`     | Redis connection string        | `redis-urlKeyVault`                            |
| Redis Username                 | `redis.username`                       | `variable`     | Redis user account             | `none`                                         |
| Redis Password                 | `redis.passwordKeyVault`               | `keyvault`     | Redis password (auto16)        | `redis-passwordKeyVault`                       |
| **Storage Configuration**      |                                        |                |                                |                                                |
| Storage Account Key            | `storage.keyKeyVault`                  | `keyvault`     | Storage account key            | `storage-keyKeyVault`                          |
| Storage Account Name           | `storage.name`                         | `variable`     | Storage account name           | `none`                                         |
| Storage Account URL            | `storage.url`                          | `variable`     | Storage account URL            | `none`                                         |
| **SMTP Configuration**         |                                        |                |                                |                                                |
| SMTP Host                      | `smtp.host`                            | `keyvault`     | SMTP server hostname           | `smtp-host`                                    |
| SMTP Port                      | `smtp.port`                            | `keyvault`     | SMTP server port               | `smtp-port`                                    |
| SMTP User                      | `smtp.user`                            | `keyvault`     | SMTP username                  | `smtp-user`                                    |
| SMTP Password                  | `smtp.passwordKeyVault`                | `keyvault`     | SMTP password (auto16)         | `smtp-passwordKeyVault`                        |
| SMTP Sender Email              | `smtp.senderEmail`                     | `keyvault`     | Default sender email           | `smtp-senderEmail`                             |
| **Front Door Configuration**   |                                        |                |                                |                                                |
| Front Door URL                 | `frontdoor.url`                        | `keyvault`     | Front Door endpoint URL        | `frontdoor-url`                                |
| Front Door Host                | `frontdoor.host`                       | `keyvault`     | Front Door hostname            | `frontdoor-host`                               |
| **App Insights Configuration** |                                        |                |                                |                                                |
| App Insights Key               | `appinsights.keyKeyVault`              | `keyvault`     | Application Insights key       | `appinsights-keyKeyVault`                      |
| App Insights Connection String | `appinsights.connectionStringKeyVault` | `keyvault`     | App Insights connection string | `appinsights-connectionStringKeyVault`         |
| **ACR Configuration**          |                                        |                |                                |                                                |
| ACR Username                   | `acr.username`                         | `keyvault`     | Container registry username    | `acr-username`                                 |
| ACR Password                   | `acr.passwordKeyVault`                 | `keyvault`     | Container registry password    | `acr-passwordKeyVault`                         |
| ACR Server                     | `acr.server`                           | `keyvault`     | Container registry server      | `acr-server`                                   |
| **Application Secrets**        |                                        |                |                                |                                                |
| API Keys                       | `secrets.apiKeyVault`                  | `keyvault`     | 32-character random string     | `{app-key}-secrets-apiKeyVault`                |
| Session Secrets                | `secrets.sessionKeyVault`              | `keyvault`     | 32-character random string     | `{app-key}-secrets-sessionKeyVault`            |
| JWT Secrets                    | `secrets.jwtKeyVault`                  | `keyvault`     | 64-character random string     | `{app-key}-secrets-jwtKeyVault`                |
| Unique Tokens                  | `secrets.tokenKeyVault`                | `keyvault`     | UUID v4 identifier             | `{app-key}-secrets-tokenKeyVault`              |