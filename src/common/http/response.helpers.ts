import { ApiResponse } from 'src/common/http/response.type';

export function ok<T>(
  data: T,
  message = 'Success',
  meta?: Record<string, unknown>,
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    meta,
  };
}

export function fail(
  message: string,
  code: string,
  details?: unknown,
): ApiResponse<null> {
  return {
    success: false,
    message,
    data: null,
    error: {
      code,
      details,
    },
  };
}
