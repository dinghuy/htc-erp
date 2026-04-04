import type { Response } from 'express';
import type { ApiError } from '../contracts/domain';

export type ApiErrorInput = {
  error: string;
  code?: string;
  details?: unknown;
};

export class HttpApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, input: ApiErrorInput) {
    super(input.error);
    this.name = 'HttpApiError';
    this.status = status;
    this.code = input.code;
    this.details = input.details;
  }
}

export function buildApiError(input: ApiErrorInput): ApiError {
  return {
    error: input.error,
    ...(input.code ? { code: input.code } : {}),
    ...(input.details !== undefined ? { details: input.details } : {}),
  };
}

export function sendApiError(res: Pick<Response, 'status' | 'json'>, status: number, input: ApiErrorInput) {
  return res.status(status).json(buildApiError(input));
}
