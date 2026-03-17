import {
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError, TypeORMError } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { fail } from 'src/common/http/response.helpers';
import { ApiRequestError, ApiResponse } from 'src/common/http/response.type';
import { handleTypeORMError } from 'src/utils';

interface PostgresError extends Error {
  code: string;
  detail?: string;
  table?: string;
  column?: string;
  constraint?: string;
}

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const env = this.configService.get<string>('NODE_ENV') ?? 'production';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let apiResponse: ApiResponse<null>;

    if (exception instanceof ApiRequestError) {
      statusCode = exception.statusCode;
      apiResponse = fail(exception.message, exception.code, exception.details);
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      apiResponse = fail(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        typeof res === 'string'
          ? res
          : ((res as any)?.message ?? 'Request failed'),
        'HTTP_EXCEPTION',
        res,
      );
    } else if (exception instanceof QueryFailedError) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      const driverError = exception.driverError as PostgresError;

      if (env === 'development') {
        apiResponse = fail(
          exception.message,
          driverError.code ?? 'DATABASE_ERROR',
          {
            detail: driverError.detail,
            table: driverError.table,
            column: driverError.column,
            constraint: driverError.constraint,
            query: exception.query,
            parameters: exception.parameters,
          },
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const mapped = handleTypeORMError(exception);
        apiResponse = fail(mapped.message, mapped.code!);
      }
    } else if (exception instanceof EntityNotFoundError) {
      statusCode = HttpStatus.NOT_FOUND;
      apiResponse = fail('Resource not found', 'ENTITY_NOT_FOUND');
    } else if (exception instanceof TypeORMError) {
      statusCode = HttpStatus.BAD_REQUEST;
      apiResponse = fail(exception.message, 'TYPEORM_ERROR');
    } else if (exception instanceof Error) {
      apiResponse = fail(
        'Internal server error',
        'INTERNAL_SERVER_ERROR',
        env === 'development' ? { stack: exception.stack } : undefined,
      );
    } else {
      apiResponse = fail('Unexpected error', 'UNKNOWN_ERROR');
    }

    this.logger.error({
      event: 'exception',
      requestId: request.requestId,
      method: request.method,
      url: request.originalUrl,
      statusCode,
      errorCode: apiResponse.error?.code,
      exception,
    });

    response.status(statusCode).json(apiResponse);
  }
}
