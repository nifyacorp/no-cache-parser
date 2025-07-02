/**
 * No-Cache Parser – Main entry point
 * A configurable generic parser service.
 */
import express from 'express';
import config, { loadSecrets, validateConfig } from './config/config.js';
import { registerMiddleware } from './middleware/index.js';
import createRoutes from './routes/index.js';

function addStartTime(req, res, next) {
  req.startTime = Date.now();
  next();
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(addStartTime);

  const middleware = registerMiddleware(app);
  app.use('/', createRoutes(middleware));
  app.use(middleware.errorHandler);
  return app;
}

function startServer(app) {
  const port = config.server.port;
  return app.listen(port, () => {
    console.log(`No-Cache Parser running on port ${port} | env=${config.env.NODE_ENV}`);
  });
}

async function init() {
  try {
    if (config.env.IS_PRODUCTION) {
      await loadSecrets();
    }
    const missing = validateConfig();
    if (missing.length) {
      console.error('Missing required configuration keys:', missing);
      process.exit(1);
    }
    const app = createApp();
    startServer(app);
  } catch (err) {
    console.error('Failed to initialise No-Cache Parser', err);
    process.exit(1);
  }
}

init();

process.on('unhandledRejection', (err) => console.error('unhandledRejection', err));
process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
  process.exit(1);
}); 