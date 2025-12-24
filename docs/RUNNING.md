# Running Your App Locally

← [Back to Quick Start](QUICK-START.md)

How to run your application in Docker for local development.

## Start Your App

```bash
aifabrix run myapp
```

### What Happens

1. **Checks infrastructure** - Postgres and Redis running?
2. **Generates docker-compose** - Creates container configuration
3. **Starts container** - Named `aifabrix-myapp`
4. **Connects services** - Links to postgres and redis
5. **Maps ports** - localhost → container
6. **Mounts volumes** - For data persistence

```mermaid
graph TB
    subgraph DockerNetwork["infra_aifabrix-network"]
        
        subgraph Infrastructure["Infrastructure"]
            InfraNote["Stateful · Always running"]
            Postgres[(PostgreSQL<br/>postgres:5432)]
            Redis[(Redis<br/>redis:6379)]
        end
        
        subgraph Applications["Applications"]
            AppNote["Start / Stop · Scale"]
            YourApp[aifabrix-myapp<br/>Port 3000]
            OtherApp[aifabrix-otherapp<br/>Port 3001]
        end
        
        YourApp -->|DATABASE_URL| Postgres
        YourApp -->|REDIS_URL| Redis
        OtherApp -->|DATABASE_URL| Postgres
        OtherApp -->|REDIS_URL| Redis
        YourApp -.->|HTTP calls| OtherApp
    end
    
    LocalhostApp[localhost:3000] -->|Port mapping| YourApp
    LocalhostDb[localhost:5432] -->|Port mapping| Postgres
    
    style DockerNetwork fill:#FFFFFF,stroke:#E5E7EB,stroke-width:2px
    style Infrastructure fill:#F9FAFB,stroke:#E5E7EB,stroke-width:2px
    style Applications fill:#E5E7EB,stroke:#6B7280,stroke-width:2px
    style InfraNote fill:#FFFFFF,stroke:#CCCCCC,stroke-dasharray: 3 3
    style AppNote fill:#FFFFFF,stroke:#CCCCCC,stroke-dasharray: 3 3
    style LocalhostApp fill:#10B981,color:#FFFFFF
    style LocalhostDb fill:#10B981,color:#FFFFFF

```

### Output

```
✓ Infrastructure is running
✓ Starting myapp...
✓ Container aifabrix-myapp started
✓ App running at http://localhost:3000
```

---

## Accessing Your App

**URL:** http://localhost:<localPort>

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
```
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
```
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
- pgAdmin: http://localhost:5050
- DBeaver, DataGrip, etc. use `localhost:5432`

```mermaid
flowchart LR
    subgraph Container["Inside Container"]
        ContainerNote["Docker network resolution"]
        App["Your App"] -->|postgres:5432<br/>Docker service name| PostgresContainer["PostgreSQL"]
    end
    
    subgraph Localhost["Local Machine"]
        LocalNote["Host access via port mapping"]
        LocalApp["Local tools"] -->|localhost:5432<br/>Port mapping| PostgresLocal["PostgreSQL"]
    end
    
    PostgresContainer --- PostgresLocal
    
    style Container fill:#F9FAFB,stroke:#E5E7EB,stroke-width:2px
    style Localhost fill:#E5E7EB,stroke:#6B7280,stroke-width:2px
    style ContainerNote fill:#FFFFFF,stroke:#CCCCCC,stroke-dasharray: 3 3
    style LocalNote fill:#FFFFFF,stroke:#CCCCCC,stroke-dasharray: 3 3

```

---

## Redis Connection

Your app connects to Redis automatically.

### From Inside Container
```
Host: redis
Port: 6379
```

SDK handles this via `.env`:
```bash
REDIS_URL=redis://redis:6379
```

### From Your Local Machine
```
Host: localhost
Port: 6379
```

**Connect with redis-cli:**
```bash
redis-cli -h localhost -p 6379
```

**Connect with GUI:**
- Redis Commander: http://localhost:8081

---

## File Storage

If `requires.storage: true`, your app gets `/mnt/data` volume.

### Inside Container
```
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

**Check DATABASE_URL:**
```bash
cat builder/myapp/.env | grep DATABASE_URL
```

**Check database exists:**
```bash
docker exec aifabrix-postgres psql -U pgadmin -l
```

**Create database:**
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

