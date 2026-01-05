import { Request, Response, NextFunction } from "express";

/**
 * A utility function that wraps async route handlers and catches any errors.
 * This avoids the need for try-catch blocks in every route handler.
 * @param fn The async route handler function.
 * @returns A new function that Express can execute.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
