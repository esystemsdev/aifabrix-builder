# Secrets and config.yaml

← [Configuration](README.md)

## config.yaml

Location: `~/.aifabrix/config.yaml`. Manages developer-id, aifabrix-home, aifabrix-secrets, aifabrix-env-config, traefik, controller, environment, device tokens, and per-environment client tokens.

**Key fields:** `developer-id` (read by `aifabrix up-infra`), `traefik` (set by `aifabrix up-infra --traefik`), `controller` and `environment` (set by login/auth config), `device` (device flow tokens), `environments.<env>.clients.<app>` (client tokens). Tokens can be encrypted at rest when `secrets-encryption` is set.

## secrets.local.yaml

Location: `~/.aifabrix/secrets.local.yaml` or path from `aifabrix-secrets` in config. Flat key-value; pattern `<app>-client-idKeyVault`, `<app>-client-secretKeyVault`, and other `*KeyVault` keys. Used by `aifabrix resolve`, `aifabrix login --method credentials`, and deploy. Never modified by the CLI; permissions 600.

## Encryption (aifabrix secure)

Run `aifabrix secure --secrets-encryption <key>` to encrypt secrets in secrets.local.yaml. Key: 32 bytes, hex or base64. Encrypted values use `secure://` prefix. Plaintext secrets work if no encryption key is configured; the system detects encrypted values and only decrypts when needed.

See [Commands: Utilities](../commands/utilities.md) for `secrets set` and `secure`.
