
### 1️⃣ Architecture

Design:

* AuthService (service layer only, no HTTP logic)
* AuthController (thin layer)
* Protect middleware (JWT verification)
* requirePermission middleware (role-based access)
* Refresh token storage strategy
* Google OAuth integration flow
* DB schema structure (User + RefreshToken collections)
* Indexing strategy (unique email, etc.)
* Token rotation strategy
* Logout + revoke logic
* Password hashing strategy
* Account lockout / brute force protection
* Email verification flow (MVP level)

Explain responsibilities clearly for each layer.

---

### 2️⃣ Security Model (MVP but correct)

Define:

* Access token lifetime
* Refresh token lifetime
* Refresh token rotation behavior
* Token reuse detection behavior
* Lockout logic after failed logins
* Email verification enforcement
* Unique index handling for race conditions
* Error handling standards (Unauthorized vs Forbidden vs Conflict)

Be realistic for MVP. Avoid overengineering.

---

### 3️⃣ Testing Strategy (Critical Section)

Design a complete testing strategy including:

#### A) Unit Tests (Service Layer Only)

For each method in AuthService:

* signup
* login
* googleLogin
* refresh
* logout
* changePassword
* checkEmail

Define:

* Happy path
* Edge cases
* Failure scenarios
* Strict mocking requirements (toHaveBeenCalledWith exact arguments)
* Idempotency tests
* Token reuse detection test
* Account lock test

Target:

* > 90% service layer coverage
* Full branch coverage for refresh logic

---

#### B) Integration Tests (API + DB)

Using:

* Jest
* Supertest
* mongodb-memory-server (or test DB)

Test full HTTP flow for:

* POST /signup
* POST /login
* POST /refresh
* POST /logout
* GET /me
* POST /change-password
* POST /google

Validate:

* DB state changes
* Refresh token storage
* Token rotation
* Lockout increments
* Permission protection
* Unique email constraint behavior

---

#### C) Middleware Tests

For:

* protect
* requirePermission

Test:

* Missing token
* Expired token
* Malformed token
* Role mismatch
* Deleted user

---

### 4️⃣ Concurrency & Data Integrity

Define:

* Unique index requirements
* How to prevent duplicate users
* How to prevent refresh token reuse
* What happens if DB write fails mid-operation
* Minimal atomicity expectations for MVP

---

### 5️⃣ Deliverables

Provide:

* Clean AuthService method signatures (TypeScript)
* Suggested Mongoose schemas
* Token payload structure
* Example error structure format
* Folder structure recommendation
* Testing folder structure recommendation

---

## Constraints

* This is MVP, not enterprise SaaS.
* Must be secure but not overengineered.
* No unnecessary microservices.
* No unnecessary abstraction layers.
* Keep it clean, deterministic, and testable.

---

Produce a structured, practical, implementation-ready output.

Avoid fluff. Be direct. Focus on architecture clarity, testability, and real-world failure handling.

---
