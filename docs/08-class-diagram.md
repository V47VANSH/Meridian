# Class Diagram

**Team 98 · Milestone 2 · Apartment Complex Management System**  
Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

This document covers two levels of the class model:

1. **Domain Entity Classes** — the core data objects of the system (maps to DB tables)
2. **Service Classes** — the backend business logic components (NestJS services)

---

## 1. Enumerations

```mermaid
classDiagram
    class Role {
        <<enumeration>>
        SUPER_ADMIN
        SOCIETY_OFFICIAL
        RESIDENT_OWNER
        NON_RESIDENT_OWNER
        SECURITY_GUARD
        MAINTENANCE_STAFF
        CLEANING_STAFF
        SERVICE_PROVIDER
    }

    class OccupancyType {
        <<enumeration>>
        OWNER_OCCUPIED
        RENTED
        VACANT
    }

    class Relation {
        <<enumeration>>
        OWNER
        RESIDENT_TENANT
    }

    class InvoiceStatus {
        <<enumeration>>
        PENDING
        PAID
        OVERDUE
    }

    class ComplaintStatus {
        <<enumeration>>
        OPEN
        IN_PROGRESS
        RESOLVED
        CLOSED
    }

    class ComplaintCategory {
        <<enumeration>>
        PLUMBING
        ELECTRICAL
        STRUCTURAL
        SECURITY
        CLEANING
        GENERAL
    }

    class UrgencyLevel {
        <<enumeration>>
        LOW
        MEDIUM
        HIGH
    }

    class BookingStatus {
        <<enumeration>>
        CONFIRMED
        CANCELLED
    }

    class GuestPassStatus {
        <<enumeration>>
        ACTIVE
        USED
        EXPIRED
        REVOKED
    }

    class SOSStatus {
        <<enumeration>>
        OPEN
        ACKNOWLEDGED
        RESOLVED
    }

    class Audience {
        <<enumeration>>
        ALL
        RESIDENTS
        NON_RESIDENT_OWNERS
        STAFF
    }

    class NotificationChannel {
        <<enumeration>>
        IN_APP
        PUSH
        EMAIL
        SMS
    }

    class NotificationType {
        <<enumeration>>
        SOS_RAISED
        PAYMENT_DUE_SOON
        PAYMENT_OVERDUE
        COMPLAINT_STATUS_CHANGED
        BOOKING_CONFIRMED
        ANNOUNCEMENT_POSTED
    }
```

---

## 2. Domain Entity Class Diagram

```mermaid
classDiagram
    direction TB

    class Tenant {
        +String id
        +String name
        +String address
        +DateTime createdAt
    }

    class User {
        +String id
        +String tenantId
        +String email
        +String passwordHash
        +Role role
        +String phone
        +String status
        +DateTime createdAt
        +isActive() Boolean
        +hasRole(role Role) Boolean
    }

    class Flat {
        +String id
        +String tenantId
        +String block
        +String flatNumber
        +OccupancyType occupancyType
    }

    class FlatOwnership {
        +String userId
        +String flatId
        +Relation relation
    }

    class MaintenanceInvoice {
        +String id
        +String tenantId
        +String flatId
        +String period
        +Float amount
        +DateTime dueDate
        +InvoiceStatus status
        +DateTime paidAt
        +markPaid() void
        +isOverdue() Boolean
    }

    class Payment {
        +String id
        +String invoiceId
        +String razorpayOrderId
        +String razorpayPaymentId
        +Float amount
        +String status
        +String method
        +DateTime createdAt
        +verify(signature String) Boolean
    }

    class PaymentRiskScore {
        +String id
        +String tenantId
        +String flatId
        +String period
        +Float riskScore
        +DateTime computedAt
        +isStale(thresholdHours Int) Boolean
    }

    class Complaint {
        +String id
        +String tenantId
        +String raisedBy
        +String flatId
        +ComplaintCategory category
        +String description
        +UrgencyLevel urgency
        +ComplaintStatus status
        +String assignedTo
        +String[] attachmentUrls
        +DateTime createdAt
        +DateTime resolvedAt
        +assign(userId String) void
        +resolve() void
        +close() void
    }

    class ComplaintStatusHistory {
        +String id
        +String complaintId
        +ComplaintStatus status
        +String changedBy
        +String note
        +DateTime changedAt
    }

    class Facility {
        +String id
        +String tenantId
        +String name
        +String type
        +Int capacity
        +String rules
    }

    class FacilitySlot {
        +String id
        +String facilityId
        +DateTime date
        +String startTime
        +String endTime
        +Boolean isBookable
        +isAvailable() Boolean
    }

    class Booking {
        +String id
        +String tenantId
        +String slotId
        +String bookedBy
        +BookingStatus status
        +DateTime createdAt
        +cancel() void
    }

    class GuestPass {
        +String id
        +String tenantId
        +String generatedBy
        +String flatId
        +String visitorName
        +String visitorPhone
        +DateTime validFrom
        +DateTime validUntil
        +String qrToken
        +GuestPassStatus status
        +DateTime usedAt
        +String verifiedBy
        +generateToken() String
        +verify(now DateTime) Boolean
        +revoke() void
    }

    class SOSIncident {
        +String id
        +String tenantId
        +String raisedBy
        +String flatId
        +SOSStatus status
        +String acknowledgedBy
        +DateTime createdAt
        +DateTime resolvedAt
        +String locationNote
        +acknowledge(guardId String) void
        +resolve() void
    }

    class Announcement {
        +String id
        +String tenantId
        +String postedBy
        +String title
        +String body
        +Audience audience
        +DateTime createdAt
    }

    class Notification {
        +String id
        +String tenantId
        +String userId
        +NotificationChannel channel
        +NotificationType type
        +JSON payload
        +DateTime readAt
        +DateTime sentAt
        +String status
        +markRead() void
    }

    class AuditLog {
        +String id
        +String tenantId
        +String actor
        +String action
        +String entityType
        +String entityId
        +DateTime createdAt
    }

    class RefreshToken {
        +String id
        +String userId
        +String tokenHash
        +DateTime expiresAt
        +DateTime revokedAt
        +isValid() Boolean
        +revoke() void
    }

    %% Tenant relationships
    Tenant "1" --> "many" User : has
    Tenant "1" --> "many" Flat : has
    Tenant "1" --> "many" Complaint : scopes
    Tenant "1" --> "many" Facility : has
    Tenant "1" --> "many" GuestPass : scopes
    Tenant "1" --> "many" SOSIncident : scopes
    Tenant "1" --> "many" Announcement : scopes
    Tenant "1" --> "many" Notification : scopes
    Tenant "1" --> "many" AuditLog : scopes
    Tenant "1" --> "many" MaintenanceInvoice : scopes

    %% User / Flat
    User "many" --> "many" Flat : owns/rents via FlatOwnership
    FlatOwnership --> User
    FlatOwnership --> Flat

    %% Maintenance
    Flat "1" --> "many" MaintenanceInvoice : generates
    MaintenanceInvoice "1" --> "many" Payment : has
    MaintenanceInvoice "1" --> "0..1" PaymentRiskScore : cached in

    %% Complaints
    User "1" --> "many" Complaint : raises
    Complaint "1" --> "many" ComplaintStatusHistory : tracks

    %% Booking
    Facility "1" --> "many" FacilitySlot : divides into
    FacilitySlot "1" --> "0..1" Booking : reserved by
    User "1" --> "many" Booking : makes

    %% Visitor & SOS
    User "1" --> "many" GuestPass : generates
    User "1" --> "many" SOSIncident : raises

    %% Notifications & Auth
    User "1" --> "many" Notification : receives
    User "1" --> "many" RefreshToken : holds
    User "1" --> "many" AuditLog : logged as actor
```

---

## 3. Service Class Diagram

```mermaid
classDiagram
    direction LR

    class AuthService {
        -PrismaService prisma
        -JwtService jwtService
        +login(email, password) TokenPair
        +register(dto RegisterDto) User
        +refreshTokens(token String) TokenPair
        +logout(userId String) void
        -hashPassword(plain String) String
        -verifyPassword(plain, hash String) Boolean
        -issueAccessToken(user User) String
        -issueRefreshToken(userId String) String
    }

    class TenantService {
        -PrismaService prisma
        +createTenant(dto CreateTenantDto) Tenant
        +getTenant(id String) Tenant
        +updateTenant(id String, dto) Tenant
        +listTenants() Tenant[]
    }

    class UserService {
        -PrismaService prisma
        +listUsers(tenantId String) User[]
        +createUser(dto CreateUserDto) User
        +updateUser(id String, dto) User
        +deleteUser(id String) void
        +assignFlat(userId, flatId, relation) FlatOwnership
    }

    class MaintenanceService {
        -PrismaService prisma
        -MLClientService mlClient
        -NotificationService notificationService
        -RazorpayClient razorpay
        +generateMonthlyInvoices(tenantId String) void
        +listInvoices(tenantId, flatId) MaintenanceInvoice[]
        +initiatePayment(invoiceId String) RazorpayOrder
        +handleWebhook(payload, signature) void
        +refreshRiskScores(tenantId String) void
        -verifyWebhookSignature(payload, sig) Boolean
    }

    class ComplaintService {
        -PrismaService prisma
        -MLClientService mlClient
        -NotificationService notificationService
        -AuditService auditService
        +createComplaint(dto CreateComplaintDto) Complaint
        +listComplaints(tenantId, filters) Complaint[]
        +assignComplaint(id, staffId) Complaint
        +updateStatus(id, status, note) Complaint
        -classifyWithFallback(description) ClassifyResult
    }

    class BookingService {
        -PrismaService prisma
        -Redis redis
        -RealtimeGateway realtimeGateway
        -NotificationService notificationService
        +listFacilities(tenantId) Facility[]
        +listSlots(facilityId, week) FacilitySlot[]
        +createBooking(dto CreateBookingDto) Booking
        +cancelBooking(id String) void
        -acquireSlotLock(slotId String) Boolean
        -releaseSlotLock(slotId String) void
    }

    class VisitorService {
        -PrismaService prisma
        -RealtimeGateway realtimeGateway
        -NotificationService notificationService
        +generateGuestPass(dto CreateGuestPassDto) GuestPass
        +listGuestPasses(flatId) GuestPass[]
        +verifyGuestPass(token String) VerifyResult
        +raiseSOS(dto SOSDto) SOSIncident
        +acknowledgeSOS(id, guardId) SOSIncident
        -generateSecureToken() String
    }

    class AnnouncementService {
        -PrismaService prisma
        -NotificationService notificationService
        +createAnnouncement(dto CreateAnnouncementDto) Announcement
        +listAnnouncements(tenantId, audience) Announcement[]
    }

    class NotificationService {
        -BullMQ queue
        -PrismaService prisma
        +notify(userId, type, payload) void
        -resolveChannels(type NotificationType) NotificationChannel[]
        -sendPush(subscription, payload) void
        -sendEmail(to, subject, body) void
        -sendSMS(phone, message) void
    }

    class AuditService {
        -PrismaService prisma
        +log(tenantId, actor, action, entityType, entityId) void
        +listLogs(tenantId, filters) AuditLog[]
    }

    class RealtimeGateway {
        -SocketIO server
        -Redis redisAdapter
        +handleConnection(socket) void
        +emitSOSRaised(tenantId, incident) void
        +emitSOSAcknowledged(tenantId, incident) void
        +emitComplaintStatusChanged(tenantId, complaint) void
        +emitBookingSlotTaken(tenantId, slotId) void
        -verifyJWT(token String) JWTPayload
        -joinRooms(socket, tenantId, userId, role) void
    }

    class MLClientService {
        -HttpClient httpClient
        +classifyComplaint(description String) ClassifyResult
        +scorePaymentRisk(features PaymentFeatures) Float
        -withFallback(call, fallback) any
    }

    class PrismaService {
        -PrismaClient client
        +onModuleInit() void
        +onModuleDestroy() void
    }

    %% Dependencies
    AuthService --> PrismaService
    TenantService --> PrismaService
    UserService --> PrismaService
    MaintenanceService --> PrismaService
    MaintenanceService --> MLClientService
    MaintenanceService --> NotificationService
    ComplaintService --> PrismaService
    ComplaintService --> MLClientService
    ComplaintService --> NotificationService
    ComplaintService --> AuditService
    BookingService --> PrismaService
    BookingService --> RealtimeGateway
    BookingService --> NotificationService
    VisitorService --> PrismaService
    VisitorService --> RealtimeGateway
    VisitorService --> NotificationService
    AnnouncementService --> PrismaService
    AnnouncementService --> NotificationService
    NotificationService --> PrismaService
    AuditService --> PrismaService
    RealtimeGateway --> PrismaService
```

---

## 4. Key Design Patterns Used

| Pattern                     | Where applied                                                                 | Purpose                                                                                |
| --------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Repository / ORM**        | `PrismaService` injected into all services                                    | Abstracts DB access; tenant filter auto-injected via Prisma Client Extension           |
| **Strategy**                | `NotificationService` — channel selection per notification type               | Channels resolved at runtime without conditionals scattered across callers             |
| **Facade**                  | `MLClientService`                                                             | Single, clean interface to the ML service; hides timeout + fallback logic from callers |
| **Observer / Event-driven** | `RealtimeGateway` emitting Socket.IO events                                   | Decouples booking/SOS/complaint state changes from client update logic                 |
| **Queue / Worker**          | `NotificationService` + BullMQ                                                | Decouples slow I/O (SMS, email) from the synchronous HTTP request lifecycle            |
| **Guard / Interceptor**     | `JwtAuthGuard`, `RolesGuard`, `TenantScopedGuard`, `TenantContextInterceptor` | Cross-cutting security applied declaratively at the controller level                   |
| **Fallback / Null Object**  | `MLClientService.withFallback()`                                              | Keeps system functional when ML service is degraded or offline                         |

---

## 5. Relationships at a Glance

```mermaid
classDiagram
    direction TB

    AuthService --> UserService : delegates user lookup
    MaintenanceService --> MLClientService : payment risk
    ComplaintService --> MLClientService : classify
    ComplaintService --> AuditService : log state changes
    BookingService --> RealtimeGateway : emit slot_taken
    VisitorService --> RealtimeGateway : emit sos.raised / sos.acknowledged
    MaintenanceService --> NotificationService : payment alerts
    ComplaintService --> NotificationService : status alerts
    BookingService --> NotificationService : booking confirmed
    VisitorService --> NotificationService : SOS alerts
    AnnouncementService --> NotificationService : announcement push
```
