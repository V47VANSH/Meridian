"""FastAPI application factory.

Serves the interactive docs at `/api/docs` and the OpenAPI spec at
`/api/openapi.json`, which is the contract the frontend generates its client
from.
"""

import logging
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.api.v1 import (
    ai,
    announcements,
    auth,
    bookings,
    complaints,
    dashboard,
    maintenance,
    tenants,
    visitors,
)
from app.core.config import settings
from app.core.errors import (
    APIError,
    api_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.db.session import init_db
from app.openapi_extras import ERROR_CATALOGUE, USER_STORY_MAPPING

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

DESCRIPTION = """
Backend API for the **Apartment Complex Management System** — a multi-tenant
platform where one deployment serves many societies, each isolated by
`tenant_id`.

### Authentication
Call `POST /api/v1/auth/login`, then send the access token as
`Authorization: Bearer <token>` on every other request. The token carries the
caller's role and society; both are read from the token, never from the request
body, so a caller cannot act outside their own society.

### Errors
Every failure returns the same shape:

```json
{"statusCode": 409, "error": "SLOT_ALREADY_BOOKED",
 "message": "This slot has already been booked", "requestId": "…"}
```

Quote `requestId` when reporting a problem — it ties the response to the
server-side log entry.
"""

TAGS_METADATA = [
    {"name": "Auth", "description": "Registration, login, token rotation and profile."},
    {
        "name": "Society Administration",
        "description": "Societies, flats, occupants and the resident directory.",
    },
    {
        "name": "Maintenance & Payments",
        "description": "Invoicing, gateway payments, collection summary and payment-risk scoring.",
    },
    {
        "name": "Complaints",
        "description": "Raising, auto-classifying, assigning and progressing complaints.",
    },
    {
        "name": "Facilities & Bookings",
        "description": "Facility calendars and race-safe slot booking.",
    },
    {
        "name": "Visitors & Emergency",
        "description": "Single-use guest passes and the SOS alert flow.",
    },
    {
        "name": "Announcements & Notifications",
        "description": "Society notices and the in-app notification feed.",
    },
    {
        "name": "Dashboard",
        "description": "Aggregated dashboard views for residents, officials, and non-resident owners.",
    },
    {
        "name": "AI Assistant",
        "description": "Natural language query processing with Gemini API.",
    },
]


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=DESCRIPTION,
        openapi_tags=TAGS_METADATA,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        contact={"name": "Team 98"},
        license_info={"name": "MIT"},
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def attach_request_id(request: Request, call_next):
        """Tag every request so a client-reported error maps to a log line."""
        request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response

    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    prefix = settings.API_V1_PREFIX
    app.include_router(auth.router, prefix=prefix)
    app.include_router(tenants.router, prefix=prefix)
    app.include_router(maintenance.router, prefix=prefix)
    app.include_router(complaints.router, prefix=prefix)
    app.include_router(bookings.router, prefix=prefix)
    app.include_router(visitors.router, prefix=prefix)
    app.include_router(announcements.router, prefix=prefix)
    app.include_router(dashboard.router, prefix=prefix)
    app.include_router(ai.router, prefix=prefix)


    @app.get("/health", tags=["Auth"], summary="Liveness probe")
    def health() -> dict:
        """Unauthenticated health check used by the uptime monitor."""
        return {"status": "ok", "version": settings.VERSION}

    def custom_openapi() -> dict:
        """Generate the spec once, then attach the hand-written documentation.

        Keeping the user-story mapping and error catalogue inside the spec means
        the published contract is self-contained and cannot drift from a
        separate document.
        """
        if app.openapi_schema:
            return app.openapi_schema

        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
            tags=app.openapi_tags,
            contact=app.contact,
            license_info=app.license_info,
        )
        schema["x-user-story-mapping"] = USER_STORY_MAPPING
        schema["x-error-catalogue"] = ERROR_CATALOGUE
        schema["servers"] = [
            {"url": "http://localhost:8000", "description": "Local development"},
        ]
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()
        if settings.SEED_ON_STARTUP:
            from app.db.seed import seed_if_empty

            seed_if_empty()

    return app


app = create_app()
