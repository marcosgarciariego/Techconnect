import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logError(err);

  // Zod validation error
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      success: false,
      error: 'Error de validación',
      details: errors,
    });
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          error: 'Ya existe un registro con estos datos',
        });
        return;
      case 'P2025':
        res.status(404).json({
          success: false,
          error: 'Registro no encontrado',
        });
        return;
      case 'P2003':
        res.status(400).json({
          success: false,
          error: 'Error de referencia: el registro relacionado no existe',
        });
        return;
      default:
        res.status(500).json({
          success: false,
          error: 'Error de base de datos',
        });
        return;
    }
  }

  // Custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Generic error
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Recurso no encontrado',
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function logError(err: unknown): void {
  if (err instanceof ZodError) {
    console.error('Validation error:', JSON.stringify(err.issues, null, 2));
    return;
  }

  if (err instanceof Error) {
    console.error(err.stack || err.message);
    return;
  }

  console.error(String(err));
}
