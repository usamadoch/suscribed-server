# Logger Guide

## Overview

The logging system uses **Winston** with two display modes:
- **Development**: Colorized, compact, human-readable format
- **Production**: Structured JSON for log aggregation (CloudWatch, Datadog, etc.)

Switching is automatic based on `NODE_ENV`.

---

## Log Formats

### Request Logs (3-line compact box)

```
┌ GET /api/posts ── 200 ✅ ── 45ms
│  04:12:33 · 699a177d (johndoe) · ::1 · 7d5075a8
└────────────────────────────────────────────────────────────
```

- **Line 1**: Method (color-coded) + full route + status + duration
- **Line 2**: Timestamp · user (or `anonymous`) · IP · short request ID
- **Line 3**: Separator

**Badges** appear for notable requests:
- `ERROR` (red) — 5xx server errors
- `WARN` (yellow) — 4xx client errors
- `SLOW` (yellow) — requests > 1000ms, plus 🐢 icon

### Error Logs (2-line compact block)

```
 UNAUTHORIZED  GET /api/conversations/unread-count ── No token provided
  04:12:33 · 401 · d0112d5a
```

- **Line 1**: Error code badge + method + route + error message
- **Line 2**: Timestamp · HTTP status · short request ID
- **Yellow** = operational (expected) errors, **Red** = unexpected server errors

### General Logs (single line)

```
04:12:33 info MongoDB connected
04:12:33 info Server running on port 5000 in development mode
```

---

## Usage

### Basic Logging

```typescript
import logger from '../config/logger.js';

logger.info('Something happened');
logger.warn('This might be a problem');
logger.error('Something broke', { details: 'context here' });
logger.debug('Verbose debugging info');
```

### Child Logger (with correlation ID)

```typescript
import { createLogger } from '../config/logger.js';

const log = createLogger(req.correlationId);
log.info('Processing payment'); // correlationId auto-attached
```

---

## Middleware Chain

Registered in `index.ts` in this order:

```
1. correlationIdMiddleware  → Assigns UUID to every request
2. requestLogger            → Logs on response finish (auto)
3. ... routes ...
4. errorHandler             → Catches errors, logs structured error block
```

Both `requestLogger` and `errorHandler` produce formatted output automatically. You do **not** need to manually log request/response data.

---

## Configuration

| Variable        | Default     | Purpose                         |
|-----------------|-------------|---------------------------------|
| `NODE_ENV`      | development | Switches between dev/prod format |
| `LOG_LEVEL`     | debug (dev) / info (prod) | Minimum log level      |

### Slow Request Threshold

Set in `logger.ts` as `SLOW_REQUEST_THRESHOLD_MS = 1000`. Any request exceeding this gets the `SLOW` badge and 🐢 icon.

---

## Production Output

In production, the same data is output as structured JSON:

```json
{
  "level": "info",
  "message": "Request completed",
  "timestamp": "2026-02-24 04:12:33",
  "service": "patreon-mvp",
  "correlationId": "7d5075a8-...",
  "method": "GET",
  "path": "/api/posts",
  "statusCode": 200,
  "duration": "45ms",
  "userId": "699a177d...",
  "ip": "::1"
}
```

File transports are added automatically:
- `logs/error.log` — errors only
- `logs/combined.log` — all levels
