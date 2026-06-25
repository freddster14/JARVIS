import { validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

/**
 * Drop this at the end of any express-validator chain in a route.
 * If there are validation errors it returns 400 with an errors array;
 * otherwise it calls next() and the request reaches the controller.
 */
export function handleValidation(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array({ onlyFirstError: true }) });
    return;
  }
  next();
}
