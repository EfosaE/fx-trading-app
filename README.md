# FX Trading App — Backend API

A NestJS backend for a multi-currency FX trading platform. Users can register, fund wallets, and trade Naira (NGN) against international currencies (USD, EUR, GBP, etc.) using real-time exchange rates.

---

## Table of Contents

- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Key Assumptions](#key-assumptions)
- [Architectural Decisions](#architectural-decisions)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Supported Currencies](#supported-currencies)
- [Scaling Considerations](#scaling-considerations)
- [Bonus: Architecture & Flow Diagrams](#bonus-architecture--flow-diagrams)

---

## Setup Instructions

### Prerequisites

- Node.js v18+
- PostgreSQL 14+ (or MySQL 8+)
- Redis 6+
- A free API key from [exchangerate-api.com](https://www.exchangerate-api.com)
- A Gmail account (or any SMTP provider) for sending OTP emails

### 1. Clone the repository

```bash
git clone https://github.com/your-username/fx-trading-app.git
cd fx-trading-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in the values as described in the [Environment Variables](#environment-variables) section below.

### 4. Run database migrations

```bash
npm run migration:run
```

### 5. Start the application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The server starts on `http://localhost:3000` by default.

### 6. Access Swagger docs

```
http://localhost:3000/api/docs
```

---

## Environment Variables

```env
# App
PORT=3000
NODE_ENV=development

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=fx_trading

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# FX Rate API
FX_API_KEY=your_exchangerate_api_key
FX_API_BASE_URL=https://v6.exchangerate-api.com/v6
FX_RATE_TTL_SECONDS=300

# Mail (Gmail SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
MAIL_FROM=FX Trading App <your_email@gmail.com>

# Wallet
INITIAL_WALLET_CURRENCY=NGN
```

---

## Key Assumptions

### User & Authentication
- Email and password are required for registration. Phone number is optional.
- OTP codes are 6-digit numeric strings, valid for 10 minutes.
- Only verified users can access wallet and trading features. Unverified users receive a `403 Forbidden` on protected routes.
- JWT tokens are used for session management. Token expiry is configurable via `JWT_EXPIRES_IN`.

### Wallet & Balances
- Each user does **not** have a single wallet with currency columns. Instead, wallet balances are modelled as separate rows in a `wallet_balance` table with a `(user_id, currency)` unique constraint. This means adding support for a new currency requires zero schema changes.
- A user's balance for a given currency is created on first use (first fund or first conversion into that currency). Users start with no balance rows.
- Funding is only supported in NGN by default, but the `POST /wallet/fund` endpoint accepts a `currency` parameter to support multi-currency funding in future.
- All monetary values are stored as `DECIMAL(18, 6)` to handle precision across currencies with very different denominations (e.g. NGN vs JPY vs BTC).

### FX Rates & Trading
- FX rates are fetched from the external API and cached in Redis with a configurable TTL (default: 5 minutes).
- Every rate used in a transaction is persisted to the `fx_rate` table. This creates a permanent audit trail — each `transaction` row carries an `fx_rate_id` FK pointing to the exact rate that was applied.
- If the external FX API is unavailable, the system falls back to the most recently stored rate in the `fx_rate` table. If no rate exists at all, the trade request returns a `503 Service Unavailable` with a clear error message.
- No trading fees or spreads are applied. The raw mid-market rate is used. (A `fee_rate` column can be added to extend this.)
- "Convert" and "Trade" are treated as the same operation at the data level — both debit one currency balance and credit another. The `type` field on the transaction (`FUND`, `CONVERT`, `TRADE`) differentiates them in history.

### Concurrency & Safety
- Wallet balance updates use database-level row locking (`SELECT ... FOR UPDATE`) inside a transaction to prevent double-spending. Two concurrent trades on the same balance will serialise correctly.
- All balance-modifying operations are wrapped in a single atomic DB transaction: debit source balance → credit target balance → insert transaction record. If any step fails, the entire operation rolls back.
- Transaction records are append-only. Once created, a transaction row is never updated or deleted (except for status: `PENDING` → `SUCCESS` or `FAILED`).

---

## Architectural Decisions

### Multi-currency wallet design
Rather than adding a column per currency on the user table, wallet balances are stored as rows in a dedicated `wallet_balance` table. A composite unique index on `(user_id, currency)` enforces one balance row per currency per user. This is the standard approach in financial systems because it scales to any number of currencies without schema migrations.

### Two-layer rate caching (Redis + PostgreSQL)
FX rates are served from Redis on cache hit (typically < 5ms). On cache miss, the rate is fetched from the external API, written to PostgreSQL for audit purposes, and then stored in Redis with a TTL. Redis is a performance layer — it can be wiped and rebuilt. PostgreSQL is the source of truth and can never be rebuilt from Redis.

### Atomic transactions with row-level locking
Every trade operation acquires a `SELECT ... FOR UPDATE` lock on the affected `wallet_balance` rows before reading or writing balances. This prevents race conditions where two concurrent requests could both read a sufficient balance and both proceed, resulting in a negative balance.

### NestJS modular structure
The application is split into four feature modules: `AuthModule`, `WalletModule`, `FxModule`, and `TransactionModule`. Each module owns its own controller, service, and repository. Cross-module communication goes through service injection, not direct repository access from other modules.

### TypeORM with repository pattern
TypeORM repositories are injected into services via `@InjectRepository()`. Raw query builder is used only where atomic operations require it (e.g. locking). All entities use UUID primary keys to avoid enumerable IDs in API responses.

### Error handling
- External API failures are caught and trigger the DB fallback rate strategy.
- All inputs are validated with `class-validator` DTOs at the controller layer.
- Insufficient balance returns `422 Unprocessable Entity` (not `400`) to distinguish a valid but unfulfilable request from a malformed one.
- Global exception filters ensure all errors return a consistent `{ statusCode, message, timestamp }` shape.

---

## API Documentation

A full Swagger UI is available at `/api/docs` when the server is running.

### Base URL
```
http://localhost:3000
```

### Authentication
All routes except `POST /auth/register` and `POST /auth/verify` require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

---

### Auth

#### `POST /auth/register`
Register a new user. Sends a 6-digit OTP to the provided email.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

**Response `201`:**
```json
{
  "message": "Registration successful. Check your email for the OTP."
}
```

---

#### `POST /auth/verify`
Verify OTP and activate the account. Returns a JWT token on success.

**Request body:**
```json
{
  "email": "user@example.com",
  "otp": "482910"
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### `POST /auth/login`
Login with email and password. Returns a JWT token.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Wallet

#### `GET /wallet`
Get all currency balances for the authenticated user.

**Response `200`:**
```json
{
  "balances": [
    { "currency": "NGN", "balance": "45000.000000" },
    { "currency": "USD", "balance": "27.430000" }
  ]
}
```

---

#### `POST /wallet/fund`
Fund the wallet in a given currency.

**Request body:**
```json
{
  "currency": "NGN",
  "amount": 50000
}
```

**Response `201`:**
```json
{
  "message": "Wallet funded successfully.",
  "transaction_id": "uuid",
  "new_balance": "95000.000000"
}
```

---

#### `POST /wallet/convert`
Convert between two currencies using the real-time FX rate.

**Request body:**
```json
{
  "from_currency": "NGN",
  "to_currency": "USD",
  "amount": 10000
}
```

**Response `201`:**
```json
{
  "transaction_id": "uuid",
  "from_currency": "NGN",
  "to_currency": "USD",
  "amount_debited": "10000.000000",
  "amount_credited": "6.060000",
  "rate_used": "1650.000000",
  "status": "SUCCESS"
}
```

**Error `422`** (insufficient balance):
```json
{
  "statusCode": 422,
  "message": "Insufficient NGN balance. Available: 5000.00, required: 10000.00"
}
```

---

#### `POST /wallet/trade`
Trade Naira against a foreign currency or vice versa. Functionally equivalent to `/wallet/convert` but logs `type: TRADE` in transaction history.

**Request body:**
```json
{
  "from_currency": "EUR",
  "to_currency": "NGN",
  "amount": 50
}
```

**Response `201`:** Same shape as `/wallet/convert`.

---

### FX Rates

#### `GET /fx/rates`
Get current FX rates for all supported currency pairs (base: NGN).

**Response `200`:**
```json
{
  "base": "NGN",
  "rates": {
    "USD": 0.000606,
    "EUR": 0.000556,
    "GBP": 0.000476,
    "GBP": 0.000476
  },
  "fetched_at": "2024-03-16T10:04:00.000Z"
}
```

---

### Transactions

#### `GET /transactions`
Get the authenticated user's full transaction history.

**Query parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `type` | string | Filter by type: `FUND`, `CONVERT`, `TRADE` |
| `status` | string | Filter by status: `SUCCESS`, `FAILED`, `PENDING` |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "CONVERT",
      "from_currency": "NGN",
      "to_currency": "USD",
      "from_amount": "10000.000000",
      "to_amount": "6.060000",
      "rate_used": "1650.000000",
      "status": "SUCCESS",
      "created_at": "2024-03-16T10:04:22.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

## Database Schema

```
USER
  id            UUID PK
  email         VARCHAR UNIQUE NOT NULL
  password_hash VARCHAR NOT NULL
  otp_code      VARCHAR
  is_verified   BOOLEAN DEFAULT false
  created_at    TIMESTAMP

WALLET_BALANCE
  id         UUID PK
  user_id    UUID FK → USER.id
  currency   VARCHAR(10) NOT NULL
  balance    DECIMAL(18,6) DEFAULT 0
  updated_at TIMESTAMP
  UNIQUE(user_id, currency)

FX_RATE
  id              UUID PK
  base_currency   VARCHAR(10)
  target_currency VARCHAR(10)
  rate            DECIMAL(18,6)
  fetched_at      TIMESTAMP
  expires_at      TIMESTAMP

TRANSACTION
  id               UUID PK
  user_id          UUID FK → USER.id
  fx_rate_id       UUID FK → FX_RATE.id (nullable for FUND)
  type             ENUM(FUND, CONVERT, TRADE)
  from_currency    VARCHAR(10)
  to_currency      VARCHAR(10)
  from_amount      DECIMAL(18,6)
  to_amount        DECIMAL(18,6)
  rate_used        DECIMAL(18,6)
  status           ENUM(PENDING, SUCCESS, FAILED)
  created_at       TIMESTAMP
```

**Relationships:**
- One `USER` has many `WALLET_BALANCE` rows (one per currency held)
- One `USER` has many `TRANSACTION` rows
- One `WALLET_BALANCE` is referenced in many `TRANSACTION` rows
- One `FX_RATE` is used in many `TRANSACTION` rows

---

## Testing

The test suite covers the three most critical areas called out in the assessment: wallet balance logic, currency conversion, and transaction integrity.

### Running the tests

```bash
# All unit tests
npm run test

# Integration / e2e tests (requires a running PostgreSQL + Redis instance)
npm run test:e2e

# Coverage report
npm run test:cov
```

---

### Unit Tests

Unit tests mock all external dependencies (database, Redis, FX API) and test service logic in isolation.

#### Wallet service — balance debit/credit

```typescript
// src/wallet/wallet.service.spec.ts
describe('WalletService', () => {
  describe('convertCurrency', () => {
    it('should debit source balance and credit target balance correctly', async () => {
      const mockNgnBalance = { currency: 'NGN', balance: 50000 };
      const mockUsdBalance = { currency: 'USD', balance: 0 };
      const mockRate = { rate: 1650, id: 'rate-uuid' };

      walletBalanceRepo.findOne
        .mockResolvedValueOnce(mockNgnBalance)  // source balance
        .mockResolvedValueOnce(mockUsdBalance); // target balance
      fxService.getRate.mockResolvedValue(mockRate);

      const result = await walletService.convertCurrency(userId, {
        from_currency: 'NGN',
        to_currency: 'USD',
        amount: 10000,
      });

      expect(result.amount_debited).toBe('10000.000000');
      expect(result.amount_credited).toBe('6.060606'); // 10000 / 1650
      expect(result.status).toBe('SUCCESS');
    });

    it('should throw 422 when source balance is insufficient', async () => {
      walletBalanceRepo.findOne.mockResolvedValue({ currency: 'NGN', balance: 500 });

      await expect(
        walletService.convertCurrency(userId, {
          from_currency: 'NGN',
          to_currency: 'USD',
          amount: 10000,
        })
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw 422 when source balance row does not exist', async () => {
      walletBalanceRepo.findOne.mockResolvedValue(null);

      await expect(
        walletService.convertCurrency(userId, {
          from_currency: 'NGN',
          to_currency: 'USD',
          amount: 5000,
        })
      ).rejects.toThrow('No NGN balance found');
    });
  });

  describe('fundWallet', () => {
    it('should create a new balance row if currency not yet held', async () => {
      walletBalanceRepo.findOne.mockResolvedValue(null); // no existing row
      walletBalanceRepo.save.mockResolvedValue({ currency: 'NGN', balance: 50000 });

      const result = await walletService.fundWallet(userId, { currency: 'NGN', amount: 50000 });

      expect(walletBalanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'NGN', balance: 50000 })
      );
      expect(result.new_balance).toBe('50000.000000');
    });

    it('should add to existing balance if currency row already exists', async () => {
      walletBalanceRepo.findOne.mockResolvedValue({ currency: 'NGN', balance: 20000 });

      const result = await walletService.fundWallet(userId, { currency: 'NGN', amount: 30000 });

      expect(result.new_balance).toBe('50000.000000');
    });
  });
});
```

#### FX service — cache and fallback behaviour

```typescript
// src/fx/fx.service.spec.ts
describe('FxService', () => {
  describe('getRate', () => {
    it('should return cached rate from Redis on cache hit', async () => {
      const cachedRate = JSON.stringify({ id: 'uuid', rate: 1650 });
      redisClient.get.mockResolvedValue(cachedRate);

      const rate = await fxService.getRate('NGN', 'USD');

      expect(rate.rate).toBe(1650);
      expect(httpService.get).not.toHaveBeenCalled(); // external API never called
    });

    it('should fetch from external API and persist to DB on cache miss', async () => {
      redisClient.get.mockResolvedValue(null); // cache miss
      httpService.get.mockReturnValue(of({ data: { conversion_rate: 1650 } }));
      fxRateRepo.save.mockResolvedValue({ id: 'new-uuid', rate: 1650 });

      const rate = await fxService.getRate('NGN', 'USD');

      expect(fxRateRepo.save).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith('fx:NGN:USD', expect.any(String), 'EX', 300);
      expect(rate.rate).toBe(1650);
    });

    it('should fall back to last DB rate when external API is down', async () => {
      redisClient.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('API timeout')));
      fxRateRepo.findOne.mockResolvedValue({ id: 'old-uuid', rate: 1640 });

      const rate = await fxService.getRate('NGN', 'USD');

      expect(rate.rate).toBe(1640); // used stale DB rate
    });

    it('should throw 503 when API is down and no DB rate exists', async () => {
      redisClient.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('timeout')));
      fxRateRepo.findOne.mockResolvedValue(null);

      await expect(fxService.getRate('NGN', 'USD')).rejects.toThrow(
        ServiceUnavailableException
      );
    });
  });
});
```

#### Auth service — OTP verification

```typescript
// src/auth/auth.service.spec.ts
describe('AuthService', () => {
  describe('verifyOtp', () => {
    it('should activate user and return JWT on valid OTP', async () => {
      const user = { email: 'test@test.com', otp_code: '482910', is_verified: false };
      userRepo.findOne.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('signed-token');

      const result = await authService.verifyOtp({ email: 'test@test.com', otp: '482910' });

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_verified: true, otp_code: null })
      );
      expect(result.access_token).toBe('signed-token');
    });

    it('should throw 400 on incorrect OTP', async () => {
      userRepo.findOne.mockResolvedValue({ otp_code: '111111', is_verified: false });

      await expect(
        authService.verifyOtp({ email: 'test@test.com', otp: '999999' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 on expired OTP', async () => {
      const expiredDate = new Date(Date.now() - 15 * 60 * 1000); // 15 min ago
      userRepo.findOne.mockResolvedValue({
        otp_code: '482910',
        otp_expires_at: expiredDate,
        is_verified: false,
      });

      await expect(
        authService.verifyOtp({ email: 'test@test.com', otp: '482910' })
      ).rejects.toThrow('OTP has expired');
    });
  });
});
```

---

### Integration Tests

Integration tests spin up a real NestJS application against a test PostgreSQL database and in-memory Redis. Each test suite resets the database state before running.

#### Wallet conversion — end to end

```typescript
// test/wallet.e2e-spec.ts
describe('POST /wallet/convert (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp(); // bootstraps NestJS with test DB
    accessToken = await registerAndVerifyUser(app, 'trader@test.com');
    await fundWallet(app, accessToken, 'NGN', 100000);
  });

  afterAll(() => app.close());

  it('should convert NGN to USD and update both balances', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallet/convert')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ from_currency: 'NGN', to_currency: 'USD', amount: 50000 })
      .expect(201);

    expect(res.body.status).toBe('SUCCESS');
    expect(Number(res.body.amount_debited)).toBe(50000);
    expect(Number(res.body.amount_credited)).toBeGreaterThan(0);

    // Verify balances were actually updated in the DB
    const walletRes = await request(app.getHttpServer())
      .get('/wallet')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const ngn = walletRes.body.balances.find(b => b.currency === 'NGN');
    const usd = walletRes.body.balances.find(b => b.currency === 'USD');

    expect(Number(ngn.balance)).toBe(50000); // 100000 - 50000
    expect(Number(usd.balance)).toBeGreaterThan(0);
  });

  it('should return 422 when balance is insufficient', async () => {
    await request(app.getHttpServer())
      .post('/wallet/convert')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ from_currency: 'NGN', to_currency: 'USD', amount: 999999999 })
      .expect(422);
  });

  it('should create a transaction record for each successful conversion', async () => {
    await request(app.getHttpServer())
      .post('/wallet/convert')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ from_currency: 'NGN', to_currency: 'USD', amount: 1000 })
      .expect(201);

    const txRes = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const conversions = txRes.body.data.filter(t => t.type === 'CONVERT');
    expect(conversions.length).toBeGreaterThan(0);
    expect(conversions[0].rate_used).toBeDefined();
  });
});
```

#### Concurrency — race condition test

```typescript
// test/wallet-concurrency.e2e-spec.ts
describe('Concurrent trade requests (race condition)', () => {
  it('should not allow double-spending when two trades fire simultaneously', async () => {
    // Fund with exactly 10000 NGN
    await fundWallet(app, token, 'NGN', 10000);

    // Fire two concurrent convert requests each requesting 8000 NGN
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/wallet/convert')
        .set('Authorization', `Bearer ${token}`)
        .send({ from_currency: 'NGN', to_currency: 'USD', amount: 8000 }),
      request(app.getHttpServer())
        .post('/wallet/convert')
        .set('Authorization', `Bearer ${token}`)
        .send({ from_currency: 'NGN', to_currency: 'USD', amount: 8000 }),
    ]);

    const statuses = [res1.status, res2.status];

    // Exactly one should succeed, the other must be rejected
    expect(statuses).toContain(201);
    expect(statuses).toContain(422);

    // Final NGN balance must never be negative
    const walletRes = await request(app.getHttpServer())
      .get('/wallet')
      .set('Authorization', `Bearer ${token}`);

    const ngn = walletRes.body.balances.find(b => b.currency === 'NGN');
    expect(Number(ngn.balance)).toBeGreaterThanOrEqual(0);
  });
});
```

---

### Test Coverage Summary

| Area | Type | What is tested |
|------|------|----------------|
| Wallet fund | Unit | New row creation, top-up of existing balance |
| Wallet convert | Unit | Correct debit/credit math, insufficient balance |
| Wallet convert | Integration | Full DB state after conversion, transaction record created |
| Concurrency | Integration | Two simultaneous trades cannot double-spend |
| FX rate cache | Unit | Redis hit skips API, miss fetches and persists |
| FX rate fallback | Unit | Stale DB rate used when API is down, 503 when no rate exists |
| OTP verify | Unit | Valid OTP activates user, expired OTP rejected, wrong OTP rejected |
| Auth guard | Integration | Protected routes return 401 without token, 403 for unverified users |

---

## Supported Currencies

| Code | Currency |
|------|----------|
| NGN  | Nigerian Naira |
| USD  | US Dollar |
| EUR  | Euro |
| GBP  | British Pound |
| GHS  | Ghanaian Cedi |
| KES  | Kenyan Shilling |
| ZAR  | South African Rand |

Additional currencies can be added by updating the `SUPPORTED_CURRENCIES` config array — no schema changes required.

---

## Scaling Considerations

- **Rate caching:** Redis TTL keeps external API calls minimal. A `@Cron` job can pre-warm the cache for all supported pairs on a schedule.
- **Database:** The `wallet_balance` and `transaction` tables are the hot paths. Index on `(user_id, currency)` for balance lookups and `(user_id, created_at DESC)` for transaction history pagination.
- **Horizontal scaling:** The app is stateless (JWT auth, Redis for shared cache). Multiple instances can run behind a load balancer without session affinity.
- **Queue:** For very high throughput, trade requests can be enqueued (e.g. BullMQ + Redis) and processed asynchronously, with webhooks or polling for status updates.

---

## Bonus: Architecture & Flow Diagrams

### Entity Relationship Diagram (ERD)

Shows all four database tables, their fields, primary/foreign keys, and the relationships between them. The key design decision visible here is that `WALLET_BALANCE` uses a `(user_id, currency)` composite unique constraint rather than per-currency columns on the `USER` table — making the schema extensible to any number of currencies without migrations.

```
USER ||--o{ WALLET_BALANCE : "has"
USER ||--o{ TRANSACTION    : "makes"
WALLET_BALANCE ||--o{ TRANSACTION : "referenced in"
FX_RATE        ||--o{ TRANSACTION : "used in"
```

| Table | Role |
|-------|------|
| `USER` | Identity and authentication |
| `WALLET_BALANCE` | One row per currency held per user |
| `TRANSACTION` | Immutable ledger — every fund, convert, and trade |
| `FX_RATE` | Audit log of every rate fetched from the external API |

---

### System Architecture

```
Client / Postman
       │
       ▼
NestJS API Gateway  ──  JWT auth guard · rate limiting
       │
  ┌────┴──────────────────────────────────┐
  │                                        │
AuthModule    WalletModule    FxModule    TransactionModule
OTP · JWT     Fund · Convert  Rates ·     History · ledger
              · Trade         Cache layer
  │                │               │
  ▼                ▼               ▼
PostgreSQL      Redis cache    External FX API
TypeORM ·       FX rates TTL   exchangerate-api.com
transactions
```

**Module responsibilities:**

| Module | Owns |
|--------|------|
| `AuthModule` | Registration, OTP generation, email dispatch, JWT issuance |
| `WalletModule` | Balance reads, funding, conversion, trading, row-level locking |
| `FxModule` | Rate lookup (Redis → external API → DB fallback), rate persistence |
| `TransactionModule` | Transaction history queries, pagination, filtering |

---

### Currency Conversion & Trade Flow

The complete path of a `POST /wallet/convert` or `POST /wallet/trade` request:

```
POST /wallet/convert
        │
        ▼
  Validate request
  (amount · currencies · user verified)
        │
   Valid? ──No──▶ 400 Bad Request
        │
       Yes
        │
        ▼
  Fetch FX rate
  Redis cache hit? ──Yes──▶ use cached rate
        │
        No
        ▼
  Call external FX API  ──▶  INSERT into fx_rate table
        │                     SET in Redis (EX 300)
        ▼
  SELECT ... FOR UPDATE
  (acquire row lock on wallet_balance)
        │
  Balance OK? ──No──▶ 422 Insufficient Balance
        │
       Yes
        │
        ▼
  Atomic DB transaction
  ├─ UPDATE wallet_balance (debit source)
  ├─ UPSERT wallet_balance (credit target)
  └─ INSERT transaction (type, amounts, rate, status=SUCCESS)
        │
        ▼
  201 · transaction record
```

**Key safety properties:**
- The `SELECT ... FOR UPDATE` lock on step 4 ensures two concurrent trades on the same balance serialise correctly — preventing double-spending.
- The entire debit + credit + log operation is a single atomic DB transaction. A failure at any step rolls the whole thing back — no partial state is ever committed.
- The `fx_rate_id` FK on every transaction row creates a permanent, queryable audit trail of exactly which rate was applied to every trade.

---

### FX Rate Population Flow

Shows how the `FX_RATE` table is populated and why both Redis and PostgreSQL are written to:

```
Two triggers:
┌─────────────────────┐    ┌──────────────────────┐
│  User trade request │    │  @Cron job (optional) │
└──────────┬──────────┘    └──────────┬────────────┘
           │                          │
           └────────────┬─────────────┘
                        ▼
             FxService.getRate(from, to)
                        │
                        ▼
               Check Redis cache
               key: fx:NGN:USD
                        │
              Hit? ─Yes─▶ return cached rate (< 5ms)
                        │
                        No (cache miss)
                        ▼
            Call external FX API
            (3 retries, exponential backoff)
                        │
               ┌────────┴────────┐
               ▼                 ▼
     INSERT into fx_rate    SET in Redis
     (permanent audit log)  (key, EX 300)
               │
               └────────┬────────┘
                        ▼
               Return rate to caller
```

**Why write to both?**
- **Redis** is the performance layer — rates are served in < 5ms, and the external API is called at most once per TTL window regardless of how many users trade simultaneously.
- **PostgreSQL** is the audit layer — every `TRANSACTION` row carries an `fx_rate_id` FK, so the exact rate applied to any trade is permanently queryable. Redis can be wiped and rebuilt; the DB cannot.
- **Fallback:** If the external API is down, `FxService` queries the most recent row in `fx_rate` for that pair and uses it rather than failing the user's trade.