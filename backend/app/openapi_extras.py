"""Documentation that the generated OpenAPI spec cannot infer from the code.

The user-story mapping and the error-code catalogue are attached to the spec as
`x-` extensions, so the submitted YAML is a complete document rather than the
route list plus a separate write-up that can drift out of date.
"""

# Each Milestone 1 epic, the user stories under it, and the endpoints that
# implement them.
USER_STORY_MAPPING = [
    {
        "epic": "E1 — Maintenance Management",
        "stories": [
            {
                "id": "US-1.1",
                "story": (
                    "As a resident, I want to see my maintenance dues so that I know what "
                    "I owe and by when."
                ),
                "endpoints": [
                    "GET /api/v1/maintenance/invoices",
                    "GET /api/v1/maintenance/invoices/{invoice_id}",
                    "GET /api/v1/maintenance/payments/{payment_id}",
                ],
            },
            {
                "id": "US-1.2",
                "story": (
                    "As a resident, I want to pay my maintenance online so that I do not "
                    "have to visit the society office."
                ),
                "endpoints": [
                    "POST /api/v1/maintenance/invoices/{invoice_id}/pay",
                    "POST /api/v1/maintenance/invoices/{invoice_id}/payments/confirm",
                    "POST /api/v1/maintenance/invoices/{invoice_id}/remind",
                    "GET /api/v1/maintenance/payments",
                ],
            },
            {
                "id": "US-1.3",
                "story": (
                    "As a society official, I want to raise monthly invoices and track "
                    "collection so that dues are transparent and auditable."
                ),
                "endpoints": [
                    "POST /api/v1/maintenance/invoices",
                    "POST /api/v1/maintenance/invoices/{invoice_id}/offline-payment",
                    "GET /api/v1/maintenance/summary",
                ],
            },
            {
                "id": "US-1.4",
                "story": (
                    "As a society official, I want to know which flats are likely to pay "
                    "late so that I can send reminders before the due date."
                ),
                "endpoints": ["GET /api/v1/maintenance/flats/{flat_id}/risk-score"],
            },
        ],
    },
    {
        "epic": "E2 — Complaint Management",
        "stories": [
            {
                "id": "US-2.1",
                "story": (
                    "As a resident, I want to raise a complaint so that maintenance issues "
                    "are recorded and acted on."
                ),
                "endpoints": ["POST /api/v1/complaints"],
            },
            {
                "id": "US-2.2",
                "story": (
                    "As a resident, I want to track my complaint's progress so that I know "
                    "it has not been forgotten."
                ),
                "endpoints": [
                    "GET /api/v1/complaints",
                    "GET /api/v1/complaints/summary",
                    "GET /api/v1/complaints/{complaint_id}",
                ],
            },
            {
                "id": "US-2.3",
                "story": (
                    "As a society official, I want complaints categorised and prioritised "
                    "automatically so that urgent issues surface first."
                ),
                "endpoints": [
                    "POST /api/v1/complaints",
                    "GET /api/v1/complaints",
                    "PATCH /api/v1/complaints/{complaint_id}/priority",
                ],
            },
            {
                "id": "US-2.4",
                "story": (
                    "As a society official, I want to assign complaints to staff and record "
                    "each status change so that responsibility is clear."
                ),
                "endpoints": [
                    "POST /api/v1/complaints/{complaint_id}/assign",
                    "PATCH /api/v1/complaints/{complaint_id}/status",
                ],
            },
        ],
    },
    {
        "epic": "E3 — Facility Management",
        "stories": [
            {
                "id": "US-3.1",
                "story": (
                    "As a resident, I want to see which facility slots are free so that I "
                    "can plan when to use the clubhouse."
                ),
                "endpoints": [
                    "GET /api/v1/facilities",
                    "GET /api/v1/facilities/{facility_id}/slots",
                    "GET /api/v1/bookings/{booking_id}",
                ],
            },
            {
                "id": "US-3.2",
                "story": (
                    "As a resident, I want to book a slot without clashing with anyone "
                    "else so that double-bookings stop happening."
                ),
                "endpoints": ["POST /api/v1/bookings", "GET /api/v1/bookings"],
            },
            {
                "id": "US-3.3",
                "story": (
                    "As a resident, I want to cancel a booking so that the slot is freed "
                    "for someone else."
                ),
                "endpoints": ["POST /api/v1/bookings/{booking_id}/cancel"],
            },
            {
                "id": "US-3.4",
                "story": (
                    "As a society official, I want to publish and black out slots so that "
                    "the calendar reflects reality."
                ),
                "endpoints": [
                    "POST /api/v1/facilities",
                    "POST /api/v1/facilities/{facility_id}/slots",
                    "PATCH /api/v1/facilities/{facility_id}/slots/{slot_id}",
                ],
            },
        ],
    },
    {
        "epic": "E4 — Visitor & Emergency Management",
        "stories": [
            {
                "id": "US-4.1",
                "story": (
                    "As a resident, I want to issue a digital pass to my visitor so that "
                    "the guard can admit them without phoning me."
                ),
                "endpoints": [
                    "POST /api/v1/visitors/guest-passes",
                    "GET /api/v1/visitors/guest-passes",
                    "GET /api/v1/visitors/guest-passes/{pass_id}",
                ],
            },
            {
                "id": "US-4.2",
                "story": (
                    "As a security guard, I want to verify a pass by scanning it so that "
                    "only expected visitors enter and no pass can be reused."
                ),
                "endpoints": ["POST /api/v1/visitors/guest-passes/{qr_token}/verify"],
            },
            {
                "id": "US-4.3",
                "story": (
                    "As a resident, I want to revoke a pass so that a cancelled visit "
                    "cannot be used to get in."
                ),
                "endpoints": ["POST /api/v1/visitors/guest-passes/{pass_id}/revoke"],
            },
            {
                "id": "US-4.4",
                "story": (
                    "As a resident, I want an SOS button so that guards are alerted "
                    "instantly in an emergency."
                ),
                "endpoints": [
                    "POST /api/v1/sos",
                    "GET /api/v1/sos",
                    "GET /api/v1/sos/{incident_id}",
                ],
            },
            {
                "id": "US-4.5",
                "story": (
                    "As a security guard, I want to acknowledge and close an SOS so that "
                    "the resident knows someone is responding."
                ),
                "endpoints": [
                    "POST /api/v1/sos/{incident_id}/acknowledge",
                    "POST /api/v1/sos/{incident_id}/resolve",
                ],
            },
        ],
    },
    {
        "epic": "E5 — Society Administration",
        "stories": [
            {
                "id": "US-5.1",
                "story": (
                    "As any user, I want to register and log in securely so that society "
                    "data is only accessible to authorised people."
                ),
                "endpoints": [
                    "POST /api/v1/auth/register",
                    "POST /api/v1/auth/login",
                    "POST /api/v1/auth/refresh",
                    "POST /api/v1/auth/logout",
                    "GET /api/v1/auth/me",
                    "GET /api/v1/dashboard/resident",
                ],
            },
            {
                "id": "US-5.2",
                "story": (
                    "As a society official, I want to manage flats and residents so that "
                    "society records stay accurate."
                ),
                "endpoints": [
                    "POST /api/v1/flats",
                    "GET /api/v1/flats",
                    "POST /api/v1/flats/{flat_id}/occupants",
                    "GET /api/v1/users",
                    "GET /api/v1/dashboard/official",
                    "GET /api/v1/audit-logs",
                ],
            },
            {
                "id": "US-5.3",
                "story": (
                    "As a society official, I want to post announcements so that residents "
                    "are informed through the platform."
                ),
                "endpoints": ["POST /api/v1/announcements", "GET /api/v1/announcements"],
            },
            {
                "id": "US-5.4",
                "story": (
                    "As a platform operator, I want to onboard societies so that one "
                    "deployment can serve many of them in isolation."
                ),
                "endpoints": ["POST /api/v1/tenants", "GET /api/v1/tenants"],
            },
        ],
    },
    {
        "epic": "E6 — Non-Resident Owner Services",
        "stories": [
            {
                "id": "US-6.1",
                "story": (
                    "As a non-resident owner, I want to track my flat's dues and complaints "
                    "remotely so that I stay informed about my property."
                ),
                "endpoints": [
                    "GET /api/v1/maintenance/invoices",
                    "GET /api/v1/complaints",
                    "GET /api/v1/dashboard/non-resident",
                ],
            },
            {
                "id": "US-6.2",
                "story": (
                    "As a non-resident owner, I want to follow society notices so that I "
                    "do not miss decisions affecting my flat."
                ),
                "endpoints": [
                    "GET /api/v1/announcements",
                    "GET /api/v1/notifications",
                    "POST /api/v1/notifications/{notification_id}/read",
                ],
            },
            {
                "id": "US-6.3",
                "story": (
                    "As a non-resident owner, I want to issue guest passes for my tenants' "
                    "visitors so that access works while I am away."
                ),
                "endpoints": ["POST /api/v1/visitors/guest-passes"],
            },
        ],
    },
]


# Every `error` code the API can return, so a client can branch on the code
# rather than parsing the human-readable message.
ERROR_CATALOGUE = {
    "description": (
        "Every error response uses the same body: statusCode, error, message and requestId. "
        "`error` is a stable machine-readable code; `message` is for humans and may be "
        "reworded. Quote `requestId` when reporting a problem — it identifies the exact "
        "server-side log entry."
    ),
    "codes": [
        {"code": "VALIDATION_ERROR", "status": 422, "meaning": "Request body or query failed validation."},
        {"code": "UNAUTHORIZED", "status": 401, "meaning": "No bearer token was supplied."},
        {"code": "INVALID_TOKEN", "status": 401, "meaning": "Token is malformed, forged, or of the wrong type."},
        {"code": "TOKEN_EXPIRED", "status": 401, "meaning": "Access or refresh token has passed its expiry."},
        {"code": "TOKEN_REVOKED", "status": 401, "meaning": "Refresh token was already rotated or logged out."},
        {"code": "INVALID_CREDENTIALS", "status": 401, "meaning": "Email or password is incorrect."},
        {"code": "ACCOUNT_INACTIVE", "status": 401, "meaning": "The account has been deactivated."},
        {"code": "TENANT_REQUIRED", "status": 400, "meaning": "Email exists in several societies; tenant_id is needed."},
        {"code": "FORBIDDEN", "status": 403, "meaning": "The caller's role may not perform this action."},
        {"code": "NO_TENANT_CONTEXT", "status": 403, "meaning": "A platform admin called a society-scoped endpoint."},
        {"code": "NOT_YOUR_INVOICE", "status": 403, "meaning": "The invoice belongs to another flat."},
        {"code": "NOT_YOUR_COMPLAINT", "status": 403, "meaning": "The complaint was raised by someone else."},
        {"code": "NOT_YOUR_BOOKING", "status": 403, "meaning": "The booking belongs to another resident."},
        {"code": "NOT_YOUR_FLAT", "status": 403, "meaning": "The caller is not linked to that flat."},
        {"code": "NOT_YOUR_PASS", "status": 403, "meaning": "The guest pass was issued by someone else."},
        {"code": "NOT_YOUR_NOTIFICATION", "status": 403, "meaning": "The notification belongs to another user."},
        {"code": "INVALID_PAYMENT_SIGNATURE", "status": 403, "meaning": "Gateway signature check failed; invoice not settled."},
        {"code": "TENANT_NOT_FOUND", "status": 404, "meaning": "No such society."},
        {"code": "USER_NOT_FOUND", "status": 404, "meaning": "No such user in this society."},
        {"code": "FLAT_NOT_FOUND", "status": 404, "meaning": "No such flat in this society."},
        {"code": "INVOICE_NOT_FOUND", "status": 404, "meaning": "No such invoice in this society."},
        {"code": "ORDER_NOT_FOUND", "status": 404, "meaning": "No payment order matches this invoice."},
        {"code": "COMPLAINT_NOT_FOUND", "status": 404, "meaning": "No such complaint in this society."},
        {"code": "FACILITY_NOT_FOUND", "status": 404, "meaning": "No such facility in this society."},
        {"code": "SLOT_NOT_FOUND", "status": 404, "meaning": "No such slot in this society."},
        {"code": "BOOKING_NOT_FOUND", "status": 404, "meaning": "No such booking in this society."},
        {"code": "PASS_NOT_FOUND", "status": 404, "meaning": "No guest pass matches this token."},
        {"code": "SOS_NOT_FOUND", "status": 404, "meaning": "No such SOS incident in this society."},
        {"code": "NOTIFICATION_NOT_FOUND", "status": 404, "meaning": "No such notification."},
        {"code": "EMAIL_ALREADY_REGISTERED", "status": 409, "meaning": "That email already exists in this society."},
        {"code": "FLAT_ALREADY_EXISTS", "status": 409, "meaning": "That block and flat number is already registered."},
        {"code": "INVOICE_ALREADY_EXISTS", "status": 409, "meaning": "An invoice already exists for that flat and period."},
        {"code": "INVOICE_ALREADY_PAID", "status": 409, "meaning": "The invoice has already been settled."},
        {"code": "ALREADY_LINKED", "status": 409, "meaning": "The user is already linked to that flat."},
        {"code": "SLOT_ALREADY_EXISTS", "status": 409, "meaning": "A slot already starts at that time."},
        {"code": "SLOT_ALREADY_BOOKED", "status": 409, "meaning": "Another resident booked the slot first."},
        {"code": "SLOT_NOT_BOOKABLE", "status": 409, "meaning": "The office has blocked this slot."},
        {"code": "ALREADY_CANCELLED", "status": 409, "meaning": "The booking is already cancelled."},
        {"code": "PASS_NOT_ACTIVE", "status": 409, "meaning": "Only an ACTIVE pass can be revoked."},
        {"code": "SOS_NOT_OPEN", "status": 409, "meaning": "The incident has already been acknowledged."},
        {"code": "SOS_ALREADY_RESOLVED", "status": 409, "meaning": "The incident is already resolved."},
        {"code": "INVALID_STATUS_TRANSITION", "status": 400, "meaning": "The complaint lifecycle does not allow that move."},
        {"code": "INVALID_ASSIGNEE", "status": 400, "meaning": "Complaints can only be assigned to staff roles."},
        {"code": "INTERNAL_SERVER_ERROR", "status": 500, "meaning": "Unexpected failure; details are logged, not returned."},
    ],
}
