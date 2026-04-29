import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          message: "Invalid request payload.",
          issues: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  if (isApiError(error)) {
    return Response.json(
      {
        error: {
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  console.error(error);

  return Response.json(
    {
      error: {
        message: "Internal server error.",
      },
    },
    { status: 500 },
  );
}