# SERVER_CODE_SKILL.md — Server-Side Code Quality & Structure Guidelines

> This file is a standing skill for AI agents and developers.
> When refactoring, reviewing, or writing new server-side code — always check against these rules first.
> These are not suggestions. They are the standard.

---

## 1. FILE LENGTH LIMITS

| File Type | Soft Limit | Hard Limit | Action |
|---|---|---|---|
| Route / Controller | 80 lines | 150 lines | Extract to service layer |
| Service file | 120 lines | 200 lines | Split by responsibility |
| Model / Schema | 100 lines | 180 lines | Split methods into separate files |
| Middleware | 40 lines | 80 lines | One middleware per file |
| Utility / Helper | 80 lines | 150 lines | Group by domain |
| Validation schema | 60 lines | 120 lines | Split by resource |
| Config file | 50 lines | 100 lines | Split by concern |
| Types / Interfaces | 100 lines | 200 lines | Split by domain |
| Test file | 200 lines | 400 lines | Split by feature/behavior |

**Soft limit** → Review whether extraction is needed.  
**Hard limit** → Stop. The file MUST be split before adding more code.

---

## 2. LAYERED ARCHITECTURE — THE CORE RULE

Every request must flow through layers in this exact order. No skipping. No reversing.

```
Request
   ↓
Router          → Routing only. No logic.
   ↓
Middleware      → Auth, validation, rate limiting.
   ↓
Controller      → Receives request. Calls service. Sends response.
   ↓
Service         → All business logic lives here.
   ↓
Repository      → All database queries live here.
   ↓
Database
```

**The hard rules of layering:**

- A **Router** never touches the database
- A **Controller** never writes a database query
- A **Service** never imports `req` or `res`
- A **Repository** never contains business logic
- A **Middleware** never calls a service directly (except auth middleware)

If any of these rules are broken, it is a refactor trigger — no exceptions.

---

## 3. CONTROLLER RULES

Controllers are thin. They do exactly three things:

1. Extract data from `req`
2. Call a service function
3. Return a response

```ts
// ❌ Bad — controller with business logic and DB query
async function createOrder(req, res) {
  const { userId, items } = req.body
  if (items.length === 0) return res.status(400).json({ error: 'No items' })
  const total = items.reduce((sum, item) => sum + item.price, 0)
  if (total > 10000) return res.status(400).json({ error: 'Limit exceeded' })
  const order = await Order.create({ userId, items, total })
  await sendEmail(userId, 'Order confirmed')
  res.status(201).json(order)
}

// ✅ Good — controller delegates everything
async function createOrder(req, res) {
  const order = await orderService.createOrder(req.body)
  res.status(201).json(order)
}
```

**Max lines per controller function: 20**  
If a controller function exceeds this, business logic has leaked in — extract it.

---

## 4. SERVICE RULES

Services own all business logic. They are framework-agnostic — no `req`, no `res`, no HTTP concepts.

```
Max lines per service function:    40 lines
Max parameters:                     3  (use options object if more needed)
Max nesting depth:                  3
Max cyclomatic complexity:          5
```

### What belongs in a service:
- Business rules and conditions
- Orchestrating multiple repository calls
- Calling external APIs or third-party SDKs
- Sending emails, notifications, events
- Data transformation before saving or after fetching

### What does NOT belong in a service:
- Raw database queries (belongs in repository)
- HTTP request/response handling (belongs in controller)
- Route definitions (belongs in router)

```ts
// ✅ Good service function
async function createOrder(data: CreateOrderInput): Promise<Order> {
  validateOrderItems(data.items)
  const total = calculateOrderTotal(data.items)
  const order = await orderRepository.create({ ...data, total })
  await notificationService.sendOrderConfirmation(order)
  return order
}
```

---

## 5. REPOSITORY RULES

Repositories are the only layer allowed to touch the database. Nothing else queries the database directly.

### Rules:
- One repository per model/collection
- Repository functions return plain data or typed objects — never raw DB cursors
- No business logic inside a repository
- All queries are named clearly by intent

```ts
// ❌ Bad — business logic in repository
async function getActiveUserOrders(userId: string) {
  const orders = await Order.find({ userId })
  return orders.filter(o => o.status !== 'cancelled' && o.total > 0) // ← logic
}

// ✅ Good — query only, no logic
async function findOrdersByUserId(userId: string): Promise<Order[]> {
  return Order.find({ userId }).lean()
}
```

**Naming pattern for repository functions:**

| Action | Naming |
|---|---|
| Fetch one | `findById`, `findByEmail` |
| Fetch many | `findAll`, `findByUserId` |
| Create | `create`, `insertMany` |
| Update | `updateById`, `updateByField` |
| Delete | `deleteById`, `softDeleteById` |
| Check existence | `existsByEmail`, `existsById` |

---

## 6. WHEN TO EXTRACT TO A SEPARATE FILE

Extract to a new file when ANY of the following is true:

| Condition | Extract To |
|---|---|
| A function is used in more than 1 service | `utils/` or `helpers/` |
| A block of logic has its own clear domain | Separate service file |
| Validation logic exceeds 20 lines | `validators/` file |
| A middleware is used across multiple routes | `middlewares/` file |
| Constants / magic values are repeated | `constants/` file |
| Types/interfaces are shared across 2+ files | `types/` file |
| External API integration logic | `integrations/` or `providers/` |
| Reusable query logic across repositories | Shared repository util |
| Error classes or error codes | `errors/` file |

---

## 7. WHAT BELONGS WHERE — FOLDER RULES

```
src/
├── routes/           Route definitions only. No logic.
├── controllers/      Thin request/response handlers. One file per resource.
├── services/         Business logic. One file per domain.
├── repositories/     Database queries. One file per model.
├── models/           Schema definitions. One file per model.
├── middlewares/      Auth, validation, logging, error handling.
├── validators/       Input validation schemas. One file per resource.
├── utils/            Pure functions. No side effects. No DB or HTTP.
├── integrations/     Third-party service clients (email, storage, SMS).
├── types/            Shared TypeScript types and interfaces.
├── constants/        Enums, magic strings, config values.
├── config/           Environment config, DB connection, app setup.
└── errors/           Custom error classes and error codes.
```

**Rule:** If you're not sure where code goes, ask:  
*"Does this handle HTTP, run business rules, or touch the database?"*
- Handles HTTP → `controllers/` or `middlewares/`
- Runs business rules → `services/`
- Touches the database → `repositories/`
- Neither → `utils/`

---

## 8. ERROR HANDLING RULES

All errors must be handled in a consistent, centralized way.

### Rules:
- Never return raw error objects to the client
- All async route handlers must be wrapped or use a try/catch
- Use custom error classes — not plain `new Error()`
- One global error handler middleware catches everything
- Log the real error internally; send a safe message to the client

```ts
// ✅ Custom error class
class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404)
  }
}

// ✅ Service throws it
async function getUserById(id: string) {
  const user = await userRepository.findById(id)
  if (!user) throw new NotFoundError('User')
  return user
}

// ✅ Global handler catches it
app.use((err, req, res, next) => {
  const status = err.statusCode ?? 500
  const message = err.isOperational ? err.message : 'Something went wrong'
  res.status(status).json({ error: message })
})
```

**Never** let a 500 error expose a stack trace or internal message to the client.

---

## 9. VALIDATION RULES

- All incoming data is validated **before** it reaches the controller
- Validation happens in middleware or a dedicated validator — never inside a service
- Required fields, types, lengths, and formats are all validated at the boundary
- Validation errors return `400` with a clear, human-readable message

```
Input arrives → Validator middleware → Controller → Service → Repository
                      ↑
              If invalid, reject here.
              Never let bad data reach the service layer.
```

---

## 10. NAMING RULES

| Thing | Convention | Example |
|---|---|---|
| Files | camelCase | `userService.ts`, `orderRepository.ts` |
| Classes | PascalCase | `UserService`, `OrderRepository` |
| Functions | camelCase, verb-first | `createUser`, `findOrderById` |
| Boolean variables | `is/has/can/should` prefix | `isActive`, `hasPermission` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE` |
| Types / Interfaces | PascalCase | `CreateUserInput`, `OrderResponse` |
| Routes (URL) | lowercase, hyphen-separated | `/api/user-orders`, `/api/reset-password` |
| DB collections | lowercase, plural | `users`, `order_items` |
| Environment variables | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET` |

---

## 11. COMPLEXITY CHECKLIST — USE BEFORE SUBMITTING CODE

- [ ] Is the file under the soft limit for its type?
- [ ] Does the controller do only: extract, call service, respond?
- [ ] Does the service contain zero DB queries?
- [ ] Does the repository contain zero business logic?
- [ ] Are all async functions wrapped with error handling?
- [ ] Are custom error classes used instead of plain `Error`?
- [ ] Is all input validated before reaching the service layer?
- [ ] Are magic numbers and hardcoded strings moved to constants?
- [ ] Are external integrations isolated in `integrations/`?
- [ ] Does any function exceed 40 lines? (Split it.)
- [ ] Is logic duplicated across two service files? (Extract it.)
- [ ] Are shared types in the `types/` folder?

---

## 12. REFACTOR TRIGGERS — WHEN AN AGENT MUST REFACTOR

An AI agent reviewing or editing code MUST flag for refactor when:

1. File exceeds the **hard limit** for its type (see Section 1)
2. A **controller** contains business logic or a database call
3. A **service** imports or uses `req`, `res`, or any HTTP object
4. A **repository** filters, transforms, or applies business rules to data
5. A function has **more than 3 parameters** without an options object
6. The same logic block appears **in more than one file**
7. Nesting is **deeper than 3 levels**
8. A service function is **longer than 40 lines**
9. Raw errors or stack traces are **returned to the client**
10. Input data reaches a service **without prior validation**

When flagging, the agent must specify:
- Which rule is violated
- What should be extracted and where it should go
- The suggested new file name and folder

---

## 13. QUICK REFERENCE CARD

```
DB query in controller?       → Move to repository
Business logic in controller? → Move to service
DB query in service?          → Move to repository
HTTP object in service?       → Remove it. Services are framework-free.
Logic in repository?          → Move to service
Inline validation in service? → Move to validator middleware
Repeated logic?               → Move to utils/
Raw Error thrown?             → Replace with custom error class
Magic value?                  → Move to constants/
External API call in service? → Move to integrations/
```

---

*Last updated: 2026 | Version: 1.0 | Apply to all server-side projects unless a project-specific override exists.*