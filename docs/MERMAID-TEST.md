# Mermaid Diagrams Test File

This file contains all Mermaid diagrams from the documentation for testing purposes.

## README.md - Overall Workflow

```mermaid
flowchart TD
    Install[Install CLI] --> Up[Start Infrastructure]
    Up --> Create[Create App]
    Create --> Build[Build Image]
    Build --> Run[Run Locally]
    Run --> Deploy[Deploy to Azure]
    
    style Install fill:#0062FF,color:#FFFFFF
    style Deploy fill:#10B981,color:#FFFFFF
```

## QUICK-START.md - Quick Start Workflow

```mermaid
flowchart TD
    Install[Install CLI] --> Up[Start Infrastructure]
    Up --> Create[Create App]
    Create --> Config[Review Configuration]
    Config --> Build[Build Image]
    Build --> Run[Run Locally]
    Run --> Register[Register Application]
    Register --> Deploy[Deploy to Azure]
    
    style Install fill:#0062FF,color:#FFFFFF
    style Deploy fill:#10B981,color:#FFFFFF
```

## QUICK-START.md - File Structure

```mermaid
graph TD
    Create[aifabrix create myapp] --> Variables[variables.yaml<br/>App configuration]
    Create --> EnvTemplate[env.template<br/>Environment variables]
    Create --> Rbac[rbac.yaml<br/>Roles & permissions]
    Create --> DeployJson[aifabrix-deploy.json<br/>Deployment manifest]
    Create --> Readme[README.md<br/>Documentation]
    
    Variables --> Build[Build Process]
    EnvTemplate --> Build
    Rbac --> Build
    
    style Create fill:#0062FF,color:#FFFFFF
    style Build fill:#3B82F6,color:#FFFFFF
```

## INFRASTRUCTURE.md - Infrastructure Architecture

```mermaid
graph TB
    subgraph Infrastructure["Infrastructure"]
        InfraNote["Stateful · Always running"]
        Postgres[(PostgreSQL)]
        Redis[(Redis)]
    end

    subgraph OpsTools["Operations Tools"]
        OpsNote["On-demand / Admin only"]
        pgAdmin[pgAdmin]
        RedisCommander[Redis Commander]
    end

    subgraph Applications["Applications"]
        AppNote["Start / Stop · Scale"]
        Keycloak[Keycloak<br/>Identity & Access]
        MisoController[Miso Controller<br/>Deployment & Governance]
        YourApp[Customer Application]
        OtherApps[Other Applications]
    end

    Applications --> Infrastructure
    OpsTools --> Infrastructure

    style Infrastructure fill:#3B82F6,color:#FFFFFF
    style Applications fill:#0062FF,color:#FFFFFF
    style OpsTools fill:#3B82F6,color:#FFFFFF
    style InfraNote fill:#ffffff,stroke:#cccccc,stroke-dasharray: 3 3
    style OpsNote fill:#ffffff,stroke:#cccccc,stroke-dasharray: 3 3
    style AppNote fill:#ffffff,stroke:#cccccc,stroke-dasharray: 3 3
```

## INFRASTRUCTURE.md - Infrastructure vs Applications

```mermaid
graph TB
    subgraph Infrastructure[Infrastructure - Always Running]
        Postgres[PostgreSQL]
        Redis[Redis]
        pgAdmin[pgAdmin]
        RedisCommander[Redis Commander]
    end
    
    subgraph Applications[Applications - Start/Stop as Needed]
        Keycloak[Keycloak<br/>Authentication]
        MisoController[Miso Controller<br/>Azure Deployment]
        YourApp[Your App]
        OtherApps[Other Apps]
    end
    
    Applications --> Infrastructure
    
    style Infrastructure fill:#3B82F6,color:#FFFFFF
    style Applications fill:#0062FF,color:#FFFFFF
```

## CONFIGURATION.md - Configuration File Relationships

```mermaid
flowchart LR
    Variables[variables.yaml<br/>App configuration] --> EnvTemplate[env.template<br/>Environment variables]
    EnvTemplate --> Env[.env<br/>Resolved variables]
    Variables --> Rbac[rbac.yaml<br/>Roles & permissions]
    Variables --> DeployJson[aifabrix-deploy.json<br/>Deployment manifest]
    Env --> Container[Docker Container]
    DeployJson --> Controller[Miso Controller]
    
    style Variables fill:#0062FF,color:#FFFFFF
    style Container fill:#10B981,color:#FFFFFF
    style Controller fill:#3B82F6,color:#FFFFFF
```

## CONFIGURATION.md - Secret Resolution Flow

```mermaid
flowchart LR
    Template[env.template<br/>kv://secret-name] --> Resolver[Secret Resolver]
    Secrets[secrets.yaml<br/>secret-name: value] --> Resolver
    EnvConfig[env-config.yaml<br/>Template variables] --> Resolver
    Resolver --> Env[.env<br/>SECRET=value<br/>Resolved]
    
    style Template fill:#0062FF,color:#FFFFFF
    style Secrets fill:#EF4444,color:#FFFFFF
    style Resolver fill:#3B82F6,color:#FFFFFF
    style Env fill:#10B981,color:#FFFFFF
```

## CONFIGURATION.md - External Integration File Structure

```mermaid
graph TD
    Variables[variables.yaml<br/>externalIntegration block] --> SchemaPath[schemaBasePath<br/>./schemas]
    SchemaPath --> SystemJson[hubspot.json<br/>External system]
    SchemaPath --> DatasourceJson1[hubspot-deal.json<br/>Datasource]
    SchemaPath --> DatasourceJson2[salesforce-contact.json<br/>Datasource]
    
    SystemJson --> Pipeline[Pipeline API]
    DatasourceJson1 --> Pipeline
    DatasourceJson2 --> Pipeline
    
    Pipeline --> Controller[Miso Controller]
    Pipeline --> Dataplane[Dataplane<br/>Schema Publishing]
    
    style Variables fill:#0062FF,color:#FFFFFF
    style SchemaPath fill:#3B82F6,color:#FFFFFF
    style Pipeline fill:#F59E0B,color:#FFFFFF
    style Controller fill:#10B981,color:#FFFFFF
    style Dataplane fill:#10B981,color:#FFFFFF
```

## BUILDING.md - Build Process Flowchart

```mermaid
flowchart TD
    Start[aifabrix build myapp] --> LoadConfig[Load variables.yaml]
    LoadConfig --> DetectLang[Detect Language]
    DetectLang --> FindDockerfile{Find Dockerfile?}
    FindDockerfile -->|Found| UseExisting[Use Existing Dockerfile]
    FindDockerfile -->|Not Found| GenerateDockerfile[Generate from Template]
    UseExisting --> BuildImage[Build Docker Image]
    GenerateDockerfile --> BuildImage
    BuildImage --> TagImage[Tag Image<br/>myapp-devID:tag]
    TagImage --> GenerateEnv[Generate .env Files]
    GenerateEnv --> DockerEnv[Docker .env<br/>builder/myapp/.env]
    GenerateEnv --> LocalEnv[Local .env<br/>envOutputPath if configured]
    DockerEnv --> Complete[Build Complete]
    LocalEnv --> Complete
    
    style Start fill:#0062FF,color:#FFFFFF
    style Complete fill:#10B981,color:#FFFFFF
```

## BUILDING.md - Language Detection Decision Tree

```mermaid
flowchart TD
    Start[Build Process] --> CheckPackage{Check package.json?}
    CheckPackage -->|Found| TypeScript[TypeScript/Node.js<br/>Node 20 Alpine]
    CheckPackage -->|Not Found| CheckRequirements{Check requirements.txt<br/>or pyproject.toml?}
    CheckRequirements -->|Found| Python[Python<br/>Python 3.11 Alpine]
    CheckRequirements -->|Not Found| UseConfig{Use variables.yaml<br/>build.language?}
    UseConfig -->|typescript| TypeScript
    UseConfig -->|python| Python
    UseConfig -->|Not Set| Error[Error: Cannot detect language]
    
    TypeScript --> Dockerfile[Generate Dockerfile]
    Python --> Dockerfile
    
    style TypeScript fill:#3B82F6,color:#FFFFFF
    style Python fill:#3B82F6,color:#FFFFFF
    style Error fill:#EF4444,color:#FFFFFF
```

## BUILDING.md - .env File Generation Flow

```mermaid
flowchart LR
    EnvTemplate[env.template<br/>Template variables] --> Resolver[Secret Resolver]
    Secrets[secrets.yaml<br/>kv:// references] --> Resolver
    EnvConfig[env-config.yaml<br/>Template values] --> Resolver
    
    Resolver --> DockerEnv[Docker .env<br/>builder/myapp/.env<br/>Docker service names<br/>Container ports]
    Resolver --> LocalEnv[Local .env<br/>envOutputPath<br/>localhost hosts<br/>Local ports]
    
    DockerEnv --> DockerContainer[Docker Container]
    LocalEnv --> LocalDev[Local Development]
    
    style EnvTemplate fill:#0062FF,color:#FFFFFF
    style Resolver fill:#3B82F6,color:#FFFFFF
    style DockerEnv fill:#10B981,color:#FFFFFF
    style LocalEnv fill:#10B981,color:#FFFFFF
```

## RUNNING.md - Container Networking

```mermaid
graph TB
    subgraph DockerNetwork[infra_aifabrix-network]
        subgraph Infrastructure[Infrastructure]
            Postgres[PostgreSQL<br/>postgres:5432]
            Redis[Redis<br/>redis:6379]
        end
        
        subgraph Applications[Applications]
            YourApp[aifabrix-myapp<br/>Port 3000]
            OtherApp[aifabrix-otherapp<br/>Port 3001]
        end
        
        YourApp -->|DATABASE_URL| Postgres
        YourApp -->|REDIS_URL| Redis
        OtherApp -->|DATABASE_URL| Postgres
        OtherApp -->|REDIS_URL| Redis
        YourApp -.->|HTTP calls| OtherApp
    end
    
    Localhost[localhost:3000] -->|Port mapping| YourApp
    Localhost2[localhost:5432] -->|Port mapping| Postgres
    
    style Infrastructure fill:#3B82F6,color:#FFFFFF
    style Applications fill:#0062FF,color:#FFFFFF
    style Localhost fill:#10B981,color:#FFFFFF
```

## RUNNING.md - Database Connection Paths

```mermaid
flowchart LR
    subgraph Container[From Inside Container]
        App[Your App] -->|postgres:5432<br/>Docker service name| PostgresContainer[PostgreSQL Container]
    end
    
    subgraph Localhost[From Local Machine]
        LocalApp[Your Local Tools] -->|localhost:5432<br/>Port mapping| PostgresLocal[PostgreSQL Container]
    end
    
    PostgresContainer[PostgreSQL<br/>Same Container]
    PostgresLocal[PostgreSQL<br/>Same Container]
    
    style Container fill:#3B82F6,color:#FFFFFF
    style Localhost fill:#0062FF,color:#FFFFFF
```

## DEPLOYING.md - Deployment Architecture

```mermaid
flowchart LR
    Local[Local Development] --> Build[Build Image]
    Build --> Push[Push to ACR<br/>myacr.azurecr.io]
    Push --> Deploy[Deploy via Controller]
    Deploy --> Controller[Miso Controller]
    Controller --> Azure[Azure Container Apps]
    
    subgraph CICD[CI/CD Pipeline]
        GitHub[GitHub Actions] --> BuildCI[Build]
        BuildCI --> PushCI[Push to ACR]
        PushCI --> DeployCI[Deploy via Controller]
        DeployCI --> Controller
    end
    
    style Local fill:#0062FF,color:#FFFFFF
    style Azure fill:#10B981,color:#FFFFFF
    style Controller fill:#3B82F6,color:#FFFFFF
    style CICD fill:#E5E7EB
```

## DEPLOYING.md - Deployment Process Flowchart

```mermaid
flowchart TD
    Start[aifabrix deploy myapp] --> ValidateEnv[Validate Environment Exists]
    ValidateEnv --> GetToken{Get/Refresh Token}
    GetToken -->|Token Missing| ReadCreds[Read Credentials<br/>secrets.local.yaml]
    ReadCreds --> Login[Login API]
    Login --> SaveToken[Save Token to config.yaml]
    GetToken -->|Token Valid| GenerateManifest[Generate Deployment Manifest]
    SaveToken --> GenerateManifest
    
    GenerateManifest --> LoadConfig[Load Config Files<br/>variables.yaml<br/>env.template<br/>rbac.yaml]
    LoadConfig --> ParseEnv[Parse Environment Variables]
    ParseEnv --> BuildManifest[Build JSON Manifest]
    BuildManifest --> GenKey[Generate Deployment Key<br/>SHA256 hash]
    GenKey --> ValidateManifest[Validate Manifest]
    ValidateManifest --> SendController[Send to Controller<br/>POST /api/v1/pipeline/env/deploy]
    SendController --> ControllerProcess[Controller Processes]
    ControllerProcess --> DeployAzure[Deploy to Azure Container Apps]
    
    style Start fill:#0062FF,color:#FFFFFF
    style DeployAzure fill:#10B981,color:#FFFFFF
    style ControllerProcess fill:#3B82F6,color:#FFFFFF
```

## DEPLOYING.md - Manifest Generation Flow

```mermaid
flowchart TD
    Variables[variables.yaml<br/>App metadata] --> Load[Load Configuration Files]
    EnvTemplate[env.template<br/>Environment variables] --> Load
    Rbac[rbac.yaml<br/>Roles & permissions] --> Load
    
    Load --> Parse[Parse Environment Variables<br/>Convert kv:// references]
    Parse --> Build[Build Deployment Manifest<br/>Merge all configuration]
    Build --> GenKey[Generate Deployment Key<br/>SHA256 hash of manifest]
    GenKey --> Validate[Validate Manifest<br/>Required fields<br/>Structure checks]
    Validate --> Send[Send to Controller<br/>POST /api/v1/pipeline/env/deploy]
    
    Send --> Poll{Poll Status?}
    Poll -->|Yes| PollStatus[Poll Deployment Status<br/>Every 5 seconds]
    PollStatus --> Complete[Deployment Complete]
    Poll -->|No| Complete
    
    style Variables fill:#0062FF,color:#FFFFFF
    style Complete fill:#10B981,color:#FFFFFF
    style Send fill:#3B82F6,color:#FFFFFF
```

## DEPLOYING.md - Authentication Methods

```mermaid
flowchart TD
    subgraph AuthMethods[Authentication Methods]
        DeviceToken[Device Token<br/>Interactive CLI<br/>User-level audit]
        ClientToken[Client Token<br/>Application-level<br/>Auto-refresh]
        ClientCreds[Client Credentials<br/>CI/CD pipelines<br/>Application-level audit]
    end
    
    Deploy[aifabrix deploy] --> CheckDevice{Device Token<br/>Available?}
    CheckDevice -->|Yes| UseDevice[Use Device Token<br/>Bearer token]
    CheckDevice -->|No| CheckClient{Client Token<br/>Available?}
    CheckClient -->|Yes| UseClient[Use Client Token<br/>Bearer token]
    CheckClient -->|No| UseCreds[Use Client Credentials<br/>x-client-id<br/>x-client-secret]
    
    UseDevice --> Controller[Miso Controller]
    UseClient --> Controller
    UseCreds --> Controller
    
    style DeviceToken fill:#0062FF,color:#FFFFFF
    style ClientToken fill:#3B82F6,color:#FFFFFF
    style ClientCreds fill:#6B7280,color:#FFFFFF
    style Controller fill:#10B981,color:#FFFFFF
```

## EXTERNAL-SYSTEMS.md - External Systems Architecture

```mermaid
flowchart LR
    ExternalAPI[External API<br/>HubSpot/Salesforce/etc] --> ExternalSystem[External System<br/>Authentication & Configuration]
    ExternalSystem --> Datasources[Datasources<br/>Field Mappings]
    Datasources --> Dataplane[Dataplane<br/>Schema Publishing]
    Dataplane --> AIModels[AI Models<br/>Query via MCP/OpenAPI]
    
    style ExternalAPI fill:#0062FF,color:#FFFFFF
    style ExternalSystem fill:#3B82F6,color:#FFFFFF
    style Datasources fill:#10B981,color:#FFFFFF
    style Dataplane fill:#10B981,color:#FFFFFF
    style AIModels fill:#F59E0B,color:#FFFFFF
```

## EXTERNAL-SYSTEMS.md - External System File Structure

```mermaid
graph TD
    Create[aifabrix create hubspot<br/>--type external] --> Variables[variables.yaml<br/>App configuration<br/>externalIntegration block]
    Create --> SystemJson[hubspot-deploy.json<br/>External system definition]
    Create --> Datasource1[hubspot-deploy-company.json<br/>Companies datasource]
    Create --> Datasource2[hubspot-deploy-contact.json<br/>Contacts datasource]
    Create --> Datasource3[hubspot-deploy-deal.json<br/>Deals datasource]
    Create --> EnvTemplate[env.template<br/>Environment variables]
    Create --> Readme[README.md<br/>Documentation]
    
    Variables --> Deploy[Deploy Process]
    SystemJson --> Deploy
    Datasource1 --> Deploy
    Datasource2 --> Deploy
    Datasource3 --> Deploy
    
    style Create fill:#0062FF,color:#FFFFFF
    style Deploy fill:#10B981,color:#FFFFFF
```

## EXTERNAL-SYSTEMS.md - Field Mapping Flow

```mermaid
flowchart LR
    ExternalAPI[External API Response<br/>properties.name.value<br/>properties.domain.value] --> FieldMappings[Field Mappings<br/>Transformations<br/>trim, toLower, toUpper]
    FieldMappings --> TransformedData[Transformed Data<br/>name: string<br/>domain: string<br/>country: string]
    TransformedData --> DataplaneSchema[Dataplane Schema<br/>Normalized structure<br/>ABAC accessFields]
    DataplaneSchema --> Query[Query via<br/>MCP/OpenAPI]
    
    style ExternalAPI fill:#0062FF,color:#FFFFFF
    style FieldMappings fill:#3B82F6,color:#FFFFFF
    style TransformedData fill:#10B981,color:#FFFFFF
    style DataplaneSchema fill:#10B981,color:#FFFFFF
    style Query fill:#F59E0B,color:#FFFFFF
```

## GITHUB-WORKFLOWS.md - CI/CD Pipeline Flow

```mermaid
flowchart TD
    Push[Push to Repository] --> CI[CI Pipeline<br/>ci.yaml]
    PR[Pull Request] --> CI
    
    CI --> Lint[Lint Job<br/>ESLint checks]
    CI --> Test[Test Job<br/>Jest with coverage]
    CI --> Security[Security Job<br/>npm audit]
    CI --> Build[Build Job<br/>Package building]
    
    Tag[Version Tag<br/>v1.0.0] --> Release[Release Pipeline<br/>release.yaml]
    Release --> Validate[Validate Job]
    Validate --> PublishNPM[Publish NPM<br/>Optional]
    Validate --> CreateRelease[Create GitHub Release]
    
    PR --> PRChecks[PR Checks<br/>pr-checks.yaml]
    PRChecks --> FileSize[File Size Validation]
    PRChecks --> TODO[TODO Detection]
    PRChecks --> CommitMsg[Commit Message Validation]
    
    style CI fill:#0062FF,color:#FFFFFF
    style Release fill:#10B981,color:#FFFFFF
    style PRChecks fill:#3B82F6,color:#FFFFFF
```

## GITHUB-WORKFLOWS.md - CI/CD Deployment Flow

```mermaid
flowchart TD
    GitHub[GitHub Actions<br/>Workflow Triggered] --> Build[Build Docker Image]
    Build --> Push[Push to ACR<br/>Azure Container Registry]
    Push --> Deploy[Deploy via Controller<br/>Pipeline API]
    Deploy --> Controller[Miso Controller]
    Controller --> Azure[Azure Container Apps]
    
    subgraph Secrets[GitHub Secrets]
        ControllerURL[MISO_CONTROLLER_URL<br/>Repository level]
        ClientID[DEV_MISO_CLIENTID<br/>Environment level]
        ClientSecret[DEV_MISO_CLIENTSECRET<br/>Environment level]
    end
    
    Secrets --> Deploy
    
    style GitHub fill:#0062FF,color:#FFFFFF
    style Azure fill:#10B981,color:#FFFFFF
    style Controller fill:#3B82F6,color:#FFFFFF
    style Secrets fill:#EF4444,color:#FFFFFF
```

---

## Color Palette Reference

- **Primary**: `#0062FF` - Main actions, start points
- **Secondary**: `#3B82F6` - Secondary actions, services
- **Success**: `#10B981` - Completion, success states
- **Error**: `#EF4444` - Errors, security-sensitive
- **Warning**: `#F59E0B` - Warnings, queries
- **Neutral Border**: `#E5E7EB` - Neutral elements
- **Subtext**: `#6B7280` - Secondary text
- **Text Color**: `#FFFFFF` - White text on colored backgrounds

