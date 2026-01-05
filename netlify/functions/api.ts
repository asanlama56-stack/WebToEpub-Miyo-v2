import express from 'express';
import serverless from 'serverless-http';
import { registerRoutes } from '../../dist/server/routes';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);

registerRoutes(httpServer, app);

export const handler = serverless(app);