"""Uniform error contract.

Every error leaving the API has the same JSON shape:

    {"statusCode": 400, "error": "VALIDATION_ERROR", "message": "...",
     "requestId": "..."}

`requestId` is attached per request by middleware so a user-reported failure
can be traced back to the exact server-side log line.
"""

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class APIError(HTTPException):
    """Application error carrying a machine-readable `error` code."""

    def __init__(self, status_code: int, error: str, message: str):
        super().__init__(status_code=status_code, detail=message)
        self.error = error
        self.message = message


class BadRequestError(APIError):
    def __init__(self, message: str, error: str = "BAD_REQUEST"):
        super().__init__(status.HTTP_400_BAD_REQUEST, error, message)


class UnauthorizedError(APIError):
    def __init__(self, message: str = "Authentication required", error: str = "UNAUTHORIZED"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, error, message)


class ForbiddenError(APIError):
    def __init__(self, message: str = "Insufficient permissions", error: str = "FORBIDDEN"):
        super().__init__(status.HTTP_403_FORBIDDEN, error, message)


class NotFoundError(APIError):
    def __init__(self, message: str = "Resource not found", error: str = "NOT_FOUND"):
        super().__init__(status.HTTP_404_NOT_FOUND, error, message)


class ConflictError(APIError):
    def __init__(self, message: str, error: str = "CONFLICT"):
        super().__init__(status.HTTP_409_CONFLICT, error, message)


def _body(request: Request, status_code: int, error: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "statusCode": status_code,
            "error": error,
            "message": message,
            "requestId": getattr(request.state, "request_id", "unknown"),
        },
    )


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return _body(request, exc.status_code, exc.error, exc.message)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Catches HTTPExceptions raised by FastAPI itself (404s, 405s, ...)."""
    default_codes = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        429: "RATE_LIMITED",
    }
    error = default_codes.get(exc.status_code, "HTTP_ERROR")
    return _body(request, exc.status_code, error, str(exc.detail))


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Flattens pydantic validation failures into one readable message."""
    problems = []
    for err in exc.errors():
        location = ".".join(str(part) for part in err["loc"] if part != "body")
        problems.append(f"{location}: {err['msg']}" if location else err["msg"])
    return _body(
        request,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "VALIDATION_ERROR",
        "; ".join(problems) or "Request validation failed",
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last resort: never leak a stack trace or internal detail to the client."""
    return _body(
        request,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred. Quote the requestId when reporting this.",
    )
