export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error?: {
    code: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(options: {
    message: string;
    code?: string;
    statusCode: number;
    details?: unknown;
    cause?: Error;
  }) {
    super(options.message);

    this.name = 'ApiRequestError';
    this.code = options.code ?? options.statusCode.toString();
    this.statusCode = options.statusCode;
    this.details = options.details;

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, ApiRequestError);
  }
}
