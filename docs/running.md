# Running Your App Locally

← [Documentation index](README.md)

How to run your application in Docker for local development.

**Use the builder instead of raw Docker:** Commands like `aifabrix run`, `aifabrix logs`, and `aifabrix down-app` use compose, resolve `.env` from `env.template`, run db-init when needed, and keep behavior consistent. Plain `docker run` / `docker logs` do not—so prefer the builder for start, stop, logs, and running a different image tag.

**Run only uses builder:** `aifabrix run <app>` only runs applications that exist in `builder/<app>/`. External systems in `integration/` are not run as Docker containers. For them: run `aifabrix validate <integration-name>`, then upload or deploy via the controller (e.g. `aifabrix upload <system-key>` or `aifabrix deploy <app>`), then test via OpenAPI endpoints.

## Start Your App

```bash
aifabrix run myapp
```

### What Happens

1. **Checks infrastructure** - Postgres and Redis running?
2. **Generates .env file** - Creates environment variables from template
3. **Generates docker-compose** - Creates container configuration
4. **Creates database** - Automatically creates database and user (if app requires database)
5. **Starts container** - Named `aifabrix-myapp`
6. **Connects services** - Links to postgres and redis
7. **Maps ports** - localhost → container
8. **Mounts volumes** - For data persistence

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Poppins, Arial Rounded MT Bold, Arial, sans-serif",
    "fontSize": "16px",
    "background": "#FFFFFF",
    "primaryColor": "#F8FAFC",
    "primaryTextColor": "#0B0E15",
    "primaryBorderColor": "#E2E8F0",
    "lineColor": "#E2E8F0",
    "textColor": "#0B0E15",
    "subGraphTitleColor": "#64748B",
    "subGraphTitleFontWeight": "500",
    "borderRadius": 16
  },
  "flowchart": {
    "curve": "linear",
    "nodeSpacing": 34,
    "rankSpacing": 34,
    "padding": 10
  }
}}%%

flowchart TB

%% =======================
%% Styles
%% =======================
classDef base fill:#FFFFFF,color:#0B0E15,stroke:#E2E8F0,stroke-width:1.5px;
classDef primary fill:#0062FF,color:#ffffff,stroke-width:0px;
classDef note fill:#FFFFFF,color:#64748B,stroke:#E2E8F0,stroke-width:1.5px,stroke-dasharray:4 4;

%% =======================
%% Docker Network
%% =======================
subgraph DockerNetwork["infra_aifabrix-network"]
    direction TB
    
    %% =======================
    %% Infrastructure
    %% =======================
    subgraph Infrastructure["Infrastructure"]
        direction TB
        InfraNote["Stateful · Always running"]:::note
        Postgres[(PostgreSQL<br/>postgres:5432)]:::base
        Redis[(Redis<br/>redis:6379)]:::base
    end
    
    %% =======================
    %% Applications
    %% =======================
    subgraph Applications["Applications"]
        direction TB
        AppNote["Start / Stop · Scale"]:::note
        YourApp[aifabrix-myapp<br/>Port 3000]:::base
        OtherApp[aifabrix-otherapp<br/>Port 3001]:::base
    end
    
    %% =======================
    %% Internal Connections
    %% =======================
    YourApp -->|DATABASE_URL| Postgres
    YourApp -->|REDIS_URL| Redis
    OtherApp -->|DATABASE_URL| Postgres
    OtherApp -->|REDIS_URL| Redis
    YourApp -.->|HTTP calls| OtherApp
end

%% =======================
%% External Connections
%% =======================
LocalhostApp[localhost:3000]:::primary -->|Port mapping| YourApp
LocalhostDb[localhost:5432]:::primary -->|Port mapping| Postgres
```

For Traefik reverse proxy setup (optional), see [Infrastructure Guide – Traefik](infrastructure.md#traefik). Start infrastructure with `aifabrix up-infra` (optionally `aifabrix up-infra --traefik`).

---

## Accessing Your App

**URL:** <http://localhost>:<localPort>

**localPort from application.yaml:**
```yaml
build:
  localPort: 3001  # You access at localhost:3001
```

**Or override:**
```bash
aifabrix run myapp --port 3002
```

---

## Database Creation

If your app has `requiresDatabase: true` in `application.yaml`, `aifabrix run` automatically creates the database and user before starting your application.

### What Gets Created

- **Database** - Database name matches your app key (e.g., `myapp`)
- **Database user** - User name follows pattern `{appKey}_user` (e.g., `myapp_user`)
- **Privileges** - Full access to the database and schema
- **Idempotent** - If database already exists, skips creation (safe to run multiple times)

### How It Works

The database initialization happens via a `db-init` service that runs before your app container starts. The process:

1. Waits for PostgreSQL to be ready
2. Checks if database already exists
3. Creates database if it doesn't exist
4. Creates database user with password from `.env` file
5. Grants all privileges and sets schema ownership

### Example Output

When you run `aifabrix run myapp`, you'll see output like:

```yaml
✓ Infrastructure is running
✓ Starting myapp...
Creating myapp database and user...
Creating database "myapp"...
Creating user "myapp_user"...
Granting privileges...
Database "myapp" created successfully!
Database initialization complete!
✓ Container aifabrix-myapp-db-init started
✓ Container aifabrix-myapp started
✓ App running at http://localhost:3000
```

### Configuration

To enable automatic database creation, ensure your `builder/<app>/application.yaml` includes:

```yaml
requires:
  database: true
```

### Multiple Databases

If your app requires multiple databases, configure them in `application.yaml`:

```yaml
requires:
  database: true
databases:
  - name: myapp_main
  - name: myapp_analytics
```

Each database will be created automatically with its own user and permissions.

### Troubleshooting Database Creation

**Check db-init logs:**
```bash
docker logs aifabrix-myapp-db-init
```

**Verify database exists:**
```bash
docker exec aifabrix-postgres psql -U pgadmin -l | grep myapp
```

**Manually create database (if needed):**
```bash
docker exec aifabrix-postgres psql -U pgadmin -c "CREATE DATABASE myapp;"
```

---

## View Logs

Use the builder so env and logs are consistent and secrets are masked:

```bash
aifabrix logs myapp
```

Shows an env summary (sensitive values masked) and the last 100 lines of logs.

**Options:**
- `-f` – follow log stream
- `-t, --tail <n>` – number of lines (default 100); `--tail 0` = full list
- `-l, --level <level>` – show only logs at this level or above (debug, info, warn, error)

**Examples:**
```bash
aifabrix logs myapp           # last 100 lines
aifabrix logs myapp -t 50     # last 50 lines
aifabrix logs myapp -t 0      # full list
aifabrix logs myapp -f        # follow (default 100, then stream)
aifabrix logs myapp --level error   # only error lines
```

---

## Stop Your App

Prefer the builder so the container and optionally the image are removed cleanly:

```bash
aifabrix down-app myapp
```

Stops the container, removes it, and removes the app’s Docker image if no other container uses it.

**Remove app volume too:**
```bash
aifabrix down-app myapp --volumes
```

---

## Restart Your App

**Restart** with the builder means: resolve `env.template` → update `.env` → (re)create/restart the container. So you get the latest env and compose setup, not just a plain container restart.

**Recommended:** After editing `env.template`, run:

```bash
aifabrix run myapp
```

If the app is already running, it stops the existing container then starts a new one with the updated env. Prefer this over raw `docker restart` so env and compose stay in sync.

---

## Database Connection

Your app connects to Postgres automatically.

### From Inside Container (your app)
```yaml
Host: postgres
Port: 5432
User: pgadmin
Password: admin123
Database: myapp
```

SDK handles this via environment variables in `.env`:
```bash
DATABASE_URL=postgresql://pgadmin:admin123@postgres:5432/myapp
DATABASE_HOST=postgres
```

### From Your Local Machine
```yaml
Host: localhost
Port: 5432
User: pgadmin
Password: admin123
Database: myapp
```

**Connect with psql:**
```bash
psql -h localhost -U pgadmin -d myapp
```

**Connect with GUI:**
- pgAdmin: <http://localhost:5050>
- DBeaver, DataGrip, etc. use `localhost:5432`

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Poppins, Arial Rounded MT Bold, Arial, sans-serif",
    "fontSize": "16px",
    "background": "#FFFFFF",
    "primaryColor": "#F8FAFC",
    "primaryTextColor": "#0B0E15",
    "primaryBorderColor": "#E2E8F0",
    "lineColor": "#E2E8F0",
    "textColor": "#0B0E15",
    "subGraphTitleColor": "#64748B",
    "subGraphTitleFontWeight": "500",
    "borderRadius": 16
  },
  "flowchart": {
    "curve": "linear",
    "nodeSpacing": 34,
    "rankSpacing": 34,
    "padding": 10
  }
}}%%

flowchart LR

%% =======================
%% Styles
%% =======================
classDef base fill:#FFFFFF,color:#0B0E15,stroke:#E2E8F0,stroke-width:1.5px;
classDef note fill:#FFFFFF,color:#64748B,stroke:#E2E8F0,stroke-width:1.5px,stroke-dasharray:4 4;

%% =======================
%% Container
%% =======================
subgraph Container["Inside Container"]
    direction TB
    ContainerNote["Docker network resolution"]:::note
    App["Your App"]:::base -->|postgres:5432<br/>Docker service name| PostgresContainer["PostgreSQL"]:::base
end

%% =======================
%% Localhost
%% =======================
subgraph Localhost["Local Machine"]
    direction TB
    LocalNote["Host access via port mapping"]:::note
    LocalApp["Local tools"]:::base -->|localhost:5432<br/>Port mapping| PostgresLocal["PostgreSQL"]:::base
end

%% =======================
%% Connection
%% =======================
PostgresContainer --- PostgresLocal
```

---

## Redis Connection

Your app connects to Redis automatically.

### From Inside Container
```yaml
Host: redis
Port: 6379
```

SDK handles this via `.env`:
```bash
REDIS_URL=redis://redis:6379
```

### From Your Local Machine
```yaml
Host: localhost
Port: 6379
```

**Connect with redis-cli:**
```bash
redis-cli -h localhost -p 6379
```

**Connect with GUI:**
- Redis Commander: <http://localhost:8081>

---

## File Storage

If `requires.storage: true`, your app gets `/mnt/data` volume.

### Inside Container

```yaml
Path: /mnt/data
```

Your app writes here:
```typescript
import fs from 'fs';
fs.writeFileSync('/mnt/data/file.txt', 'content');
```

### On Your Machine
Data is in Docker volume: `myapp_data`

**View volume:**
```bash
docker volume inspect myapp_data
```

**Access files:**
```bash
docker exec aifabrix-myapp ls -la /mnt/data
```

**Copy file out:**
```bash
docker cp aifabrix-myapp:/mnt/data/file.txt ./
```

**Copy file in:**
```bash
docker cp ./file.txt aifabrix-myapp:/mnt/data/
```

---

## Environment Variables

Your app sees variables from the `.env` file that the builder generates from `env.template`.

**Workflow:** Edit **only** `env.template`, then run **one command** to apply settings:

```bash
aifabrix run myapp
```

That resolves `env.template`, updates `.env`, and (re)starts the container—no manual `.env` editing for normal use.

**View environment (masked):**
```bash
aifabrix logs myapp
```
(Shows env summary with secrets masked at the top, then logs.)

---

## Networking

All containers are on `infra_aifabrix-network`. The **service name** used by other containers to reach your app is the app key (e.g. **myapp**), not the container name.

**Containers can reach each other by name:**
- `postgres` – Database
- `redis` – Cache
- `keycloak` – If running
- **myapp** – Your app (service name)
- **otherapp** – Other apps (service names)

**Example:** App A calls App B (no SSL locally):
```typescript
// From app A
fetch('http://otherapp:3000/api/v1/data')
```

---

## Common Tasks

### Restart After Code Change
```bash
aifabrix build myapp
aifabrix run myapp
```

### Run Different Version
Use the builder so compose and env stay correct:
```bash
aifabrix run myapp --tag v1.0.0
```
Runs the image with the given tag (overrides `image.tag` from application.yaml).

### Execute Command in Container
```bash
docker exec aifabrix-myapp npm run migrate
docker exec -it aifabrix-myapp sh  # Interactive shell
```

### Check Container Status
```bash
docker ps | grep myapp
docker inspect aifabrix-myapp
```

### View Resource Usage
```bash
docker stats aifabrix-myapp
```

---

## Troubleshooting

### "Infrastructure not running"

**Fix:**
```bash
aifabrix up-infra
```

**Check:**
```bash
docker ps | grep postgres
docker ps | grep redis
```

### "Port already in use"

**Find what's using it:**
```bash
# Linux/Mac
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

**Fix:**
```bash
# Stop conflicting service or use different port
aifabrix run myapp --port 3001
```

### "Can't connect to database"

**Note:** `aifabrix run` automatically creates the database if `requiresDatabase: true` is set in `application.yaml`. If you're seeing connection errors:

1. **Ensure database requirement is enabled:**
   ```yaml
   # In builder/myapp/application.yaml
   requires:
     database: true
   ```

2. **Check that db-init service completed successfully:**
   ```bash
   docker logs aifabrix-myapp-db-init
   ```
   Look for "Database initialization complete!" message.

3. **Check DATABASE_URL:**
   ```bash
   cat builder/myapp/.env | grep DATABASE_URL
   ```

4. **Verify database exists:**
   ```bash
   docker exec aifabrix-postgres psql -U pgadmin -l | grep myapp
   ```

**Manually create database (if automatic creation failed):**
```bash
docker exec aifabrix-postgres psql -U pgadmin -c "CREATE DATABASE myapp;"
```

### "Container starts but immediately stops"

**Check logs:**
```bash
aifabrix logs myapp
```

**Common causes:**
- App crashes on startup
- Missing environment variable
- Can't connect to database
- Port already bound inside container

**Debug:**
```bash
# Run interactively to see what happens
docker run -it --rm \
  --network infra_aifabrix-network \
  myapp:latest sh
```

### "Can't reach other containers"

**Check network:**
```bash
docker network inspect infra_aifabrix-network
```

**Verify name resolution:**
```bash
docker exec aifabrix-myapp ping postgres
docker exec aifabrix-myapp nslookup postgres
```

### "Changes not reflected"

**Rebuild and restart:**
```bash
aifabrix build myapp
aifabrix run myapp
```

**Check image:**
```bash
docker images myapp:latest
# Should have recent timestamp
```

---

## Development Tips

### Live Reload

Mount your code as volume for hot reload:
```bash
docker run -d \
  --name aifabrix-myapp \
  --network infra_aifabrix-network \
  -p 3000:3000 \
  -v $(pwd):/app \
  myapp:latest npm run dev
```

### Debug Mode
Edit `env.template` (e.g. add `DEBUG=*`, `NODE_ENV=development`), then run:
```bash
aifabrix run myapp --debug
```
The `--debug` flag enables detailed container and port information. For Node.js inspect, add the port to your template and use `--port` if needed.

### Multiple Instances

Run multiple instances with different ports:
```bash
aifabrix run myapp --port 3001
docker run -d --name aifabrix-myapp-2 -p 3002:3000 myapp:latest
docker run -d --name aifabrix-myapp-3 -p 3003:3000 myapp:latest
```

### Clean Slate

Remove everything and start fresh:
```bash
aifabrix down-app myapp --volumes
aifabrix build myapp
aifabrix run myapp
```
`down-app` stops the container, removes it, and removes the image if unused. Use `--volumes` to remove the app’s data volume.

**Without removing volumes:**
```bash
aifabrix down-app myapp
aifabrix build myapp
aifabrix run myapp
```

**Next steps:** To deploy, see [Deploying](deploying.md). For an example application and the miso-client SDK (TypeScript/Python), see [aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client).

