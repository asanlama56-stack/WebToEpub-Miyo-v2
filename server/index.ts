import "./dotenv";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { log } from "./utils/logger";

const app = express();
const httpServer = createServer(app);

// Add a custom property to the IncomingMessage interface
// to hold the raw request body.
// This is used by the express.json middleware.
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// The express.json middleware is used to parse incoming JSON requests.
// The verify option is used to capture the raw request body before it is parsed.
// This is useful for debugging and logging.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// The express.urlencoded middleware is used to parse incoming URL-encoded requests.
app.use(express.urlencoded({ extended: false }));

// This middleware logs every incoming request.
// It captures the request method, path, status code, and response time.
// It also logs the response body for API requests.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // We're monkey-patching the res.json method to capture the response body.
  // This is a bit of a hack, but it's a simple way to log the response body
  // without having to modify the application code.
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine, "express");
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // This is a generic error handler for the application.
  // It catches any unhandled errors and returns a JSON response.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  serveStatic(app);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`, "express");
    },
  );
})();
