import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { log } from "../utils/logger";

/**
 * A centralized error handler for the Express application.
 * This middleware catches errors and sends a standardized JSON response.
 * It handles Zod errors separately to provide more detailed validation messages.
 * @param err The error object.
 * @param _req The Express request object.
 * @param res The Express response object.
 * @param _next The next middleware function.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  log(`Error: ${err.message}`, "error-handler");

  if (err instanceof ZodError) {
    const readableError = fromZodError(err);
    return res.status(400).json({ success: false, message: readableError.message });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ success: false, message });
}
