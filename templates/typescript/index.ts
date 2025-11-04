import express from 'express';
import { Pool } from 'pg';
import { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Database connection pool
let dbPool: Pool | null = null;

function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  try {
    dbPool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
    });
    return dbPool;
  } catch (error) {
    console.error('Failed to initialize database pool:', error);
    return null;
  }
}

async function checkDatabase(): Promise<{ connected: boolean; error?: string }> {
  // If DATABASE_URL is not set, try to connect using individual environment variables
  if (!dbPool && process.env.DATABASE_URL) {
    // DATABASE_URL was set but pool initialization failed
    return { connected: false, error: 'Database pool not initialized' };
  }
  
  // If no DATABASE_URL, try to create connection from individual vars
  if (!dbPool) {
    const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'postgres';
    const port = parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432', 10);
    const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'postgres';
    const user = process.env.DATABASE_USER || process.env.DB_USER || 'pgadmin';
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'admin123';
    
    if (!host && !database) {
      return { connected: false, error: 'Database not configured' };
    }
    
    try {
      const tempPool = new Pool({
        host,
        port,
        database,
        user,
        password,
        connectionTimeoutMillis: 5000,
      });
      const client = await tempPool.connect();
      await client.query('SELECT 1');
      client.release();
      await tempPool.end();
      return { connected: true };
    } catch (error: any) {
      return { connected: false, error: error.message || 'Database connection failed' };
    }
  }

  try {
    const client = await dbPool.connect();
    await client.query('SELECT 1');
    client.release();
    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error.message || 'Database connection failed' };
  }
}

// Initialize database on startup
initDatabase();

// Health check endpoint with database connectivity check
app.get('/health', async (req: Request, res: Response) => {
  const healthStatus: any = {
    status: 'ok',
    timestamp: new Date().toISOString()
  };

  // Check database connection if database is configured (DATABASE_URL or individual vars)
  const databaseUrl = process.env.DATABASE_URL;
  const databaseHost = process.env.DATABASE_HOST || process.env.DB_HOST;
  const databaseName = process.env.DATABASE_NAME || process.env.DB_NAME;
  
  // Only check database if database is configured
  if (databaseUrl || databaseHost || databaseName) {
    const dbCheck = await checkDatabase();
    if (dbCheck.connected) {
      healthStatus.database = 'connected';
    } else {
      healthStatus.database = 'error';
      healthStatus.database_error = dbCheck.error;
      return res.status(503).json(healthStatus);
    }
  }

  res.status(200).json(healthStatus);
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'AI Fabrix Application', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
