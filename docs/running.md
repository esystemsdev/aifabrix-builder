# Running Your App Locally

← [Back to Quick Start](quick-start.md)

How to run your application in Docker for local development.

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

## Traefik Routing (Optional)

When `frontDoorRouting.enabled` is set to `true` in your `variables.yaml`, the builder automatically generates Traefik labels for reverse proxy routing.

### Configuration

Add to your `variables.yaml`:

```yaml
frontDoorRouting:
  enabled: true
  host: ${DEV_USERNAME}.aifabrix.dev
  pattern: /api/*
  tls: true
```

### Accessing Your App

Once running, your app will be accessible via:
- **Traefik hostname**: `dev01.aifabrix.dev/api` (for developer-id 1)
- **Direct port**: `http://localhost:3000` (still works)

### Requirements

- Traefik must be running and connected to the same Docker network (`infra-aifabrix-network` or `infra-dev{N}-aifabrix-network`)
- Traefik must be configured to listen on ports 80 (HTTP) and/or 443 (HTTPS)
- DNS or `/etc/hosts` entry pointing `${DEV_USERNAME}.aifabrix.dev` to `localhost` (for local development)

### Example Traefik Setup

If you don't have Traefik running, start infrastructure with Traefik:

```bash
# Start infrastructure including Traefik
aifabrix up --traefik
```

**Note:** The builder generates Traefik labels automatically - you just need Traefik running.

### Wildcard Certificate Setup

If you have a wildcard certificate and want to use it:

```yaml
# In your variables.yaml
frontDoorRouting:
  enabled: true
  host: ${DEV_USERNAME}.aifabrix.dev
  pattern: /api/*
  tls: true
  certStore: wildcard  # Use your certificate store name
```

Configure Traefik with the certificate store:

```bash
export TRAEFIK_CERT_STORE=wildcard
export TRAEFIK_CERT_FILE=/path/to/wildcard.crt
export TRAEFIK_KEY_FILE=/path/to/wildcard.key
```

Then start infrastructure with Traefik:

```bash
aifabrix up --traefik
```

If you run Traefik separately, use this configuration:

```yaml
traefik:
  image: traefik:v3.6
  command:
    - "--providers.docker=true"
    - "--providers.docker.exposedbydefault=false"
    - "--entrypoints.web.address=:80"
    - "--entrypoints.websecure.address=:443"
    - "--certificatesstores.wildcard.defaultcertificate.certfile=/certs/wildcard.crt"
    - "--certificatesstores.wildcard.defaultcertificate.keyfile=/certs/wildcard.key"
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - ./certs:/certs  # Mount your wildcard certificate files
  networks:
    - infra-aifabrix-network
```

### Output

```yaml
✓ Infrastructure is running
✓ Starting myapp...
✓ Container aifabrix-myapp started
✓ App running at http://localhost:3000
```

---

## Accessing Your App

**URL:** <http://localhost>:<localPort>

**localPort from variables.yaml:**
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

If your app has `requiresDatabase: true` in `variables.yaml`, `aifabrix run` automatically creates the database and user before starting your application.

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

To enable automatic database creation, ensure your `builder/<app>/variables.yaml` includes:

```yaml
requires:
  database: true
```

### Multiple Databases

If your app requires multiple databases, configure them in `variables.yaml`:

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

```bash
docker logs aifabrix-myapp -f
```

**-f** = follow (stream new logs)

**Without follow:**
```bash
docker logs aifabrix-myapp
```

**Last 100 lines:**
```bash
docker logs aifabrix-myapp --tail 100
```

---

## Stop Your App

```bash
docker stop aifabrix-myapp
```

**Or:**
```bash
docker rm -f aifabrix-myapp  # Stop and remove
```

---

## Restart Your App

```bash
aifabrix run myapp
```

If already running, stops first then restarts.

**Quick restart (keep container):**
```bash
docker restart aifabrix-myapp
```

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

Your app sees variables from `.env` file.

**View environment:**
```bash
docker exec aifabrix-myapp env
```

**Specific variable:**
```bash
docker exec aifabrix-myapp sh -c 'echo $DATABASE_URL'
```

**Update .env:**
1. Edit `builder/myapp/env.template`
2. Rebuild: `aifabrix build myapp`
3. Restart: `aifabrix run myapp`

---

## Networking

All containers are on `infra_aifabrix-network`.

**Containers can reach each other by name:**
- `postgres` - Database
- `redis` - Cache
- `aifabrix-keycloak` - If running
- `aifabrix-myapp` - Your app
- `aifabrix-otherapp` - Other apps

**Example:** App A calls App B:
```typescript
// From app A
fetch('http://aifabrix-appb:3000/api/v1/data')
```

---

## Common Tasks

### Restart After Code Change
```bash
aifabrix build myapp
aifabrix run myapp
```

### Run Different Version
```bash
docker run -d \
  --name aifabrix-myapp-test \
  --network infra_aifabrix-network \
  -p 3001:3000 \
  myapp:v1.0.0
```

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
aifabrix up
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

**Note:** `aifabrix run` automatically creates the database if `requiresDatabase: true` is set in `variables.yaml`. If you're seeing connection errors:

1. **Ensure database requirement is enabled:**
   ```yaml
   # In builder/myapp/variables.yaml
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
docker logs aifabrix-myapp
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

```bash
docker run -d \
  --name aifabrix-myapp \
  --network infra_aifabrix-network \
  -p 3000:3000 \
  -p 9229:9229 \
  -e NODE_ENV=development \
  -e DEBUG=* \
  myapp:latest
```

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
aifabrix down myapp --volumes
docker rmi myapp:latest
aifabrix build myapp
aifabrix run myapp
```

**Without removing volumes:**
```bash
aifabrix down myapp
docker rmi myapp:latest
aifabrix build myapp
aifabrix run myapp
```

