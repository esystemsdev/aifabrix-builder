# Authentication Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Commands for authenticating with Miso Controller and managing authentication tokens.

---

## aifabrix login

Authenticate with Miso Controller.

**What:** Logs in to the controller and stores authentication token for subsequent operations. Supports multiple tokens per environment (device login tokens vs client credentials tokens).

**When:** First time using the CLI, when token expires, or when switching controllers/environments.

**Usage:**
```bash
# Login with default localhost:3000 (interactive prompts)
aifabrix login

# Login with custom controller URL
aifabrix login --controller https://controller.aifabrix.ai

# Credentials login with app (reads from secrets.local.yaml)
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak

# Credentials login with explicit credentials
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak --client-id $CLIENT_ID --client-secret $CLIENT_SECRET

# Device code flow with environment
aifabrix login --controller http://localhost:3010 --method device --environment miso

# Device code flow with offline token (long-lived refresh token)
aifabrix login --controller http://localhost:3010 --method device --environment miso --offline

# Device code flow with custom scope
aifabrix login --controller http://localhost:3010 --method device --environment miso --scope "openid profile email offline_access"
```

**Options:**
- `-c, --controller <url>` - Controller URL (default: <http://localhost:3000>)
- `-m, --method <method>` - Authentication method: `device` or `credentials` (optional, prompts if not provided)
- `-a, --app <app>` - Application name (required for credentials method, reads from secrets.local.yaml using pattern `<app-name>-client-idKeyVault`)
- `--client-id <id>` - Client ID for credentials method (optional, overrides secrets.local.yaml)
- `--client-secret <secret>` - Client Secret for credentials method (optional, overrides secrets.local.yaml)
- `-e, --environment <env>` - Environment key (updates root-level environment in config.yaml, e.g., miso, dev, tst, pro)
- `--offline` - Request offline token with `offline_access` scope (device flow only, adds to default scope)
- `--scope <scopes>` - Custom OAuth2 scope string (device flow only, default: `"openid profile email"`)

**Authentication Methods:**

1. **ClientId + ClientSecret (Credentials)**
   - Use `--method credentials` with `--app` flag (required)
   - Reads credentials from `~/.aifabrix/secrets.local.yaml` using pattern:
     - `<app-name>-client-idKeyVault` for client ID
     - `<app-name>-client-secretKeyVault` for client secret
   - If credentials not found in secrets.local.yaml, prompts interactively
   - Can override with `--client-id` and `--client-secret` flags
   - Token is saved per app and environment in config.yaml
   - Useful for application-specific deployments

2. **Device Code Flow (Environment)**
   - Use `--method device` with optional `--environment` flag
   - If `--environment` not provided, prompts interactively
   - Authenticate with only an environment key
   - **Offline Tokens**: Use `--offline` flag to request `offline_access` scope for long-lived refresh tokens
   - **Custom Scopes**: Use `--scope` option to specify custom OAuth2 scopes (default: `"openid profile email"`)
   - When `--offline` is used, `offline_access` is automatically added to the scope
   - **Note**: `--offline` and `--scope` options are only available for device flow (ignored for credentials method)
   - No client credentials required
   - Useful for initial setup before application registration
   - Follows OAuth2 Device Code Flow (RFC 8628)
   - Token is saved at root level in config.yaml, keyed by controller URL (universal per controller)
   - Includes refresh token for automatic token renewal on 401 errors

**Output (Credentials):**
```yaml
🔐 Logging in to Miso Controller...

Controller URL: http://localhost:3010
Environment: miso

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
App: keycloak
Token stored securely in ~/.aifabrix/config.yaml
```

**Output (Device Code):**
```yaml
🔐 Logging in to Miso Controller...

Controller URL: http://localhost:3010
Environment: miso

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Example:**

With flags:
```bash
aifabrix login --controller http://localhost:3010 --method device --environment dev
```

Interactive (prompts for environment):
```bash
aifabrix login --controller http://localhost:3010 --method device
# Prompts: Environment key (e.g., miso, dev, tst, pro): dev
```

**Credentials Login Example:**

Reads from secrets.local.yaml:
```bash
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak --environment miso
```

This reads:
- `keycloak-client-idKeyVault` from `~/.aifabrix/secrets.local.yaml`
- `keycloak-client-secretKeyVault` from `~/.aifabrix/secrets.local.yaml`

And saves the token to config.yaml under `environments.miso.clients.keycloak`.

**Device Code Flow Output:**
```yaml
📱 Initiating device code flow...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Device Code Flow Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To complete authentication:
  1. Visit: https://auth.example.com/device
  2. Enter code: ABCD-EFGH
  3. Approve the request

Waiting for approval...
⏳ Waiting for approval (attempt 1)...
✅ Authentication approved!

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Steps:**

1. CLI initiates device code flow with environment key
2. Display user code and verification URL
3. User visits URL and enters code in browser
4. User approves request in browser
5. CLI polls for token (automatically)
6. Token is saved to configuration

**Environment Management:**

The `--environment` flag updates the root-level `environment` in `~/.aifabrix/config.yaml`, which indicates the currently selected environment. This environment is used by default in subsequent commands like `deploy`.

**CI/CD Usage Examples:**

```bash
# GitHub Actions / Azure DevOps
aifabrix login \
  --controller ${{ secrets.MISO_CONTROLLER_URL }} \
  --method credentials \
  --app myapp \
  --environment dev

# Device code flow in CI/CD (if environment key is available)
aifabrix login \
  --controller $CONTROLLER_URL \
  --method device \
  --environment $ENVIRONMENT_KEY
```

**Issues:**
- **"Invalid method"** → Method must be `device` or `credentials`
- **"Login failed"** → Check controller URL and credentials
- **"Token expired"** → Run login again
- **"Not logged in"** → Run `aifabrix login` before other commands
- **"Device code expired"** → Restart device code flow (codes expire after ~10 minutes)
- **"Authorization declined"** → User denied the request; run login again
- **"Device code initiation failed"** → Check environment key is valid and controller is accessible
- **"Environment key must contain only letters, numbers, hyphens, and underscores"** → Use valid environment format (e.g., miso, dev, tst, pro)

**Next Steps:**
After logging in, you can:
- Register applications: `aifabrix app register`
- Deploy applications: `aifabrix deploy`

---

## aifabrix logout

Clear authentication tokens from config.yaml.

**What:** Removes stored authentication tokens from `~/.aifabrix/config.yaml`. Supports clearing all tokens or specific tokens based on options (controller, environment, app). Preserves other configuration settings like `developer-id`, `environment`, `secrets-encryption`, etc.

**When:** When you want to log out, switch accounts, or clear expired tokens.

**Usage:**
```bash
# Clear all tokens (both device and client tokens)
aifabrix logout

# Clear device token for specific controller
aifabrix logout --controller http://localhost:3000

# Clear all client tokens for specific environment
aifabrix logout --environment dev

# Clear client token for specific app in environment
aifabrix logout --environment dev --app myapp
```

**Options:**
- `-c, --controller <url>` - Clear device tokens for specific controller (device tokens only)
- `-e, --environment <env>` - Clear client tokens for specific environment (client tokens only)
- `-a, --app <app>` - Clear client tokens for specific app (requires --environment, client tokens only)

**Token Types:**

1. **Device Tokens** (root level, keyed by controller URL)
   - Stored at `config.device[controllerUrl]`
   - Cleared with `--controller` option or when no options provided
   - Universal per controller (not environment-specific)

2. **Client Tokens** (per environment and app)
   - Stored at `config.environments[env].clients[appName]`
   - Cleared with `--environment` and/or `--app` options or when no options provided
   - Environment and app-specific

**Output (Clear All):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared 2 device token(s)
✓ Cleared 5 client token(s)

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (Clear Specific Controller):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared device token for controller: http://localhost:3000

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (Clear Specific Environment):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared 3 client token(s) for environment 'dev'

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (No Tokens Found):**
```yaml
🔓 Clearing authentication tokens...

  No device tokens found
  No client tokens found

⚠️  No tokens found to clear
Config file: ~/.aifabrix/config.yaml
```

**What Gets Preserved:**

The logout command only removes token-related entries. The following settings are preserved:
- `developer-id` - Developer ID for port isolation
- `environment` - Currently selected environment
- `secrets-encryption` - Encryption key for token encryption
- `aifabrix-secrets` - Default secrets file path
- `aifabrix-home` - Base directory override
- `aifabrix-env-config` - Custom environment config path
- All other non-token configuration

**Examples:**

Clear all tokens:
```bash
aifabrix logout
```

Clear device token for specific controller:
```bash
aifabrix logout --controller https://controller.example.com
```

Clear all client tokens for environment:
```bash
aifabrix logout --environment dev
```

Clear specific app token:
```bash
aifabrix logout --environment dev --app myapp
```

**Validation:**

- `--app` requires `--environment` option
- Controller URL must be a valid HTTP or HTTPS URL
- Environment key must contain only letters, numbers, hyphens, and underscores

**Issues:**
- **"--app requires --environment option"** → Provide `--environment` when using `--app`
- **"Controller URL is required"** → Provide a valid controller URL
- **"Controller URL must be a valid HTTP or HTTPS URL"** → Use format like `http://localhost:3000` or `https://controller.example.com`
- **"Environment key must contain only letters, numbers, hyphens, and underscores"** → Use valid format (e.g., `dev`, `tst`, `pro`)

**Next Steps:**
After logging out, you can:
- Log in again: `aifabrix login`
- Switch to different controller/environment: `aifabrix login --controller <url> --environment <env>`

