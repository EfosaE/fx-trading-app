import { QueryFailedError } from 'typeorm';

interface PostgresError extends Error {
  code: string;
  detail?: string;
  table?: string;
  column?: string;
  constraint?: string;
  schema?: string;
}

interface TypeORMErrorResponse {
  message: string;
  code?: string;
}

export function handleTypeORMError(
  error: QueryFailedError,
): TypeORMErrorResponse {
  const driverError = error.driverError as PostgresError;

  // Check if it's a PostgreSQL error with a code
  if (!driverError.code) {
    return {
      message: error.message,
    };
  }

  switch (driverError.code) {
    case '23505': // Unique constraint violation
      return {
        message: extractUniqueConstraintMessage(driverError),
        code: 'UNIQUE_VIOLATION',
      };

    case '23503': // Foreign key constraint violation
      return {
        message: extractForeignKeyMessage(driverError),
        code: 'FOREIGN_KEY_VIOLATION',
      };

    case '23502': // Not null constraint violation
      return {
        message: extractNotNullMessage(driverError),
        code: 'NOT_NULL_VIOLATION',
      };

    case '23514': // Check constraint violation
      return {
        message: extractCheckConstraintMessage(driverError),
        code: 'CHECK_VIOLATION',
      };

    case '22P02': // Invalid text representation
      return {
        message: 'Invalid data format provided',
        code: 'INVALID_TEXT_REPRESENTATION',
      };

    case '22001': // String data right truncation
      return {
        message: 'The provided value is too long for this field',
        code: 'STRING_TOO_LONG',
      };

    case '22003': // Numeric value out of range
      return {
        message: 'The numeric value is out of acceptable range',
        code: 'NUMERIC_OUT_OF_RANGE',
      };

    case '23001': // Restrict violation
      return {
        message:
          'This record cannot be deleted because it is referenced by other records',
        code: 'RESTRICT_VIOLATION',
      };

    case '42P01': // Undefined table
      return {
        message: 'Database table does not exist',
        code: 'UNDEFINED_TABLE',
      };

    case '42703': // Undefined column
      return {
        message: 'Database column does not exist',
        code: 'UNDEFINED_COLUMN',
      };

    case '42501': // Insufficient privilege
      return {
        message: 'Insufficient database permissions',
        code: 'INSUFFICIENT_PRIVILEGE',
      };

    case '40001': // Serialization failure
      return {
        message: 'Transaction conflict detected, please retry',
        code: 'SERIALIZATION_FAILURE',
      };

    case '40P01': // Deadlock detected
      return {
        message: 'Database deadlock detected, please retry',
        code: 'DEADLOCK_DETECTED',
      };

    case '53300': // Too many connections
      return {
        message: 'Database connection limit reached',
        code: 'TOO_MANY_CONNECTIONS',
      };

    default:
      return {
        message: `Database operation failed: ${driverError.message || error.message}`,
        code: driverError.code,
      };
  }
}

function extractUniqueConstraintMessage(error: PostgresError): string {
  // PostgreSQL format: Key (column)=(value) already exists
  // Example: Key (email)=(test@example.com) already exists

  if (error.detail) {
    const columnMatch = error.detail.match(/Key \(([^)]+)\)/);
    if (columnMatch) {
      const column = columnMatch[1];
      // Clean up column name (remove quotes, convert snake_case to readable)
      const cleanColumn = column.replace(/"/g, '').replace(/_/g, ' ');
      return `A record with this ${cleanColumn} already exists`;
    }
  }

  // Fallback to constraint name if available
  if (error.constraint) {
    const constraintName = error.constraint.replace(/_/g, ' ');
    return `Unique constraint violation: ${constraintName}`;
  }

  return 'A record with these values already exists';
}

function extractForeignKeyMessage(error: PostgresError): string {
  // PostgreSQL format: Key (column)=(value) is not present in table "table_name"

  if (error.detail) {
    const tableMatch = error.detail.match(/table "([^"]+)"/);
    const columnMatch = error.detail.match(/Key \(([^)]+)\)/);

    if (tableMatch && columnMatch) {
      const table = tableMatch[1].replace(/_/g, ' ');
      const column = columnMatch[1].replace(/"/g, '').replace(/_/g, ' ');
      return `The referenced ${table} with ${column} does not exist`;
    }

    if (tableMatch) {
      return `The referenced ${tableMatch[1].replace(/_/g, ' ')} does not exist`;
    }
  }

  if (error.constraint) {
    return `Foreign key constraint violation: ${error.constraint.replace(/_/g, ' ')}`;
  }

  return 'The referenced record does not exist';
}

function extractNotNullMessage(error: PostgresError): string {
  // PostgreSQL format: null value in column "column_name" violates not-null constraint

  if (error.column) {
    const cleanColumn = error.column.replace(/_/g, ' ');
    return `The field '${cleanColumn}' is required and cannot be empty`;
  }

  // Try to extract from error message
  const match = error.message?.match(/column "([^"]+)"/);
  if (match) {
    const column = match[1].replace(/_/g, ' ');
    return `The field '${column}' is required and cannot be empty`;
  }

  return 'A required field is missing';
}

function extractCheckConstraintMessage(error: PostgresError): string {
  if (error.constraint) {
    const constraintName = error.constraint.replace(/_/g, ' ');
    return `Check constraint violation: ${constraintName}`;
  }

  if (error.detail) {
    return error.detail;
  }

  return 'Value does not meet validation requirements';
}

export function extractHttpExceptionMessage(res: unknown): string {
  if (typeof res === 'string') return res;

  if (typeof res === 'object' && res !== null && 'message' in res) {
    const msg = (res as any).message;
    return Array.isArray(msg) ? msg.join(', ') : String(msg);
  }

  return 'Request failed';
}
