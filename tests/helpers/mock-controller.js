/**
 * Mock Miso Controller for Testing
 *
 * Provides axios interceptor-based mocking for deployment functionality.
 * Simulates controller API responses with configurable scenarios.
 *
 * @fileoverview Mock controller for testing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const axios = require('axios');
const http = require('http');

let mockController;
let deployCounter = 0;
const deployments = new Map();

/**
 * Creates a mock controller server using axios interceptors
 *
 * @param {Object} options - Configuration options
 * @param {Function} [options.onDeploy] - Custom deploy handler
 * @param {Function} [options.onStatus] - Custom status handler
 * @param {number} [options.port] - Server port (default: 3010)
 * @returns {Promise<Object>} Mock controller instance
 */
async function createMockController(options = {}) {
  const port = options.port || 3010;
  deployCounter = 0;
  deployments.clear();

  // Create a simple HTTP server for the mock controller
  const server = http.createServer((req, res) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/api/pipeline/deploy' && req.method === 'POST') {
        const manifest = JSON.parse(body);
        deployCounter++;
        const deploymentId = `deploy-${deployCounter}-${Date.now()}`;

        deployments.set(deploymentId, {
          id: deploymentId,
          manifest,
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        const defaultResponse = {
          success: true,
          deploymentId,
          deploymentUrl: `https://app.example.com/${manifest.key}`,
          message: 'Deployment initiated successfully'
        };

        if (options.onDeploy) {
          const customResponse = options.onDeploy({ body: manifest, res });
          if (customResponse && customResponse.error) {
            res.statusCode = 500;
            res.end(JSON.stringify(customResponse));
          } else {
            res.statusCode = 200;
            res.end(JSON.stringify(customResponse || defaultResponse));
          }
        } else {
          res.statusCode = 200;
          res.end(JSON.stringify(defaultResponse));
        }

      } else if (req.url?.startsWith('/api/pipeline/status/') && req.method === 'GET') {
        const deploymentId = req.url.split('/').pop();
        const deployment = deployments.get(deploymentId);

        if (!deployment) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Deployment not found', deploymentId }));
          return;
        }

        // Simulate status progression
        const elapsed = Date.now() - new Date(deployment.createdAt).getTime();
        if (elapsed > 5000 && deployment.status === 'pending') {
          deployment.status = 'completed';
        }

        const defaultResponse = {
          deploymentId: deployment.id,
          status: deployment.status,
          progress: deployment.status === 'pending' ? 50 : 100,
          manifest: deployment.manifest
        };

        if (options.onStatus) {
          const customResponse = options.onStatus(deployment);
          res.statusCode = 200;
          res.end(JSON.stringify(customResponse || defaultResponse));
        } else {
          res.statusCode = 200;
          res.end(JSON.stringify(defaultResponse));
        }

      } else if (req.url === '/health' && req.method === 'GET') {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'ok', service: 'mock-controller' }));

      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, 'localhost', () => {
      mockController = {
        server,
        url: `http://localhost:${port}`,
        deployments,
        shutdown: () => new Promise(resolveShutdown => {
          server.close(resolveShutdown);
        })
      };
      resolve(mockController);
    });

    server.on('error', reject);
  });
}

/**
 * Shuts down the mock controller
 */
async function shutdownMockController() {
  if (mockController) {
    await mockController.shutdown();
    mockController = null;
  }
}

/**
 * Gets the current mock controller instance
 */
function getMockController() {
  return mockController;
}

module.exports = {
  createMockController,
  shutdownMockController,
  getMockController
};
