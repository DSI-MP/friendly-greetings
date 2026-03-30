# Transport Management System - Backend

## Enterprise Employee Overtime Transport Management System

Production-grade NestJS backend with PostgreSQL, JWT auth, role-based access control, and corridor-based vehicle grouping.

## Quick Start

```bash
cd backend
npm install

# Copy env and configure
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# Start development
npm run start:dev
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/transport_mgmt` |
| `JWT_SECRET` | JWT signing secret (change in production!) | `change-me` |
| `JWT_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `ENABLE_SWAGGER` | Enable Swagger docs | `true` |
| `DB_AUTO_CREATE_TABLES` | Auto-create tables via TypeORM sync | `true` |
| `DB_DROP_AND_RECREATE` | Drop and recreate schema (dev only!) | `false` |
| `SEED_ENABLED` | Run seeds on startup | `true` |
| `SEED_MODE` | `none` / `bootstrap` / `demo` | `bootstrap` |
| `DEMO_PASSWORD` | Password for all demo accounts | `password123` |
| **Depot / Origin** | | |
| `DEPOT_LAT` | Depot origin latitude | `6.0477241` |
| `DEPOT_LNG` | Depot origin longitude | `80.2479661` |
| **Vehicle Defaults** | | |
| `VAN_CAPACITY` | Van seating capacity | `15` |
| `BUS_CAPACITY` | Bus seating capacity | `52` |
| `VAN_SOFT_OVERFLOW` | Van soft overflow allowance | `2` |
| `BUS_SOFT_OVERFLOW` | Bus soft overflow allowance | `10` |
| `MIN_VAN_OCCUPANCY` | Minimum van occupancy target | `5` |
| `MIN_BUS_OCCUPANCY` | Minimum bus occupancy target | `15` |
| **Amazon Location Service (V2)** | | |
| `AWS_REGION` | AWS region for Amazon Location | `eu-north-1` |
| `AMAZON_LOCATION_API_KEY` | Amazon Location API key for Maps V2 + Routes V2 | _(empty)_ |
| `AMAZON_LOCATION_AUTH_MODE` | `api-key` or future `sigv4` mode | `api-key` |
| `AMAZON_LOCATION_MAP_STYLE` | Maps V2 style (`Standard`, `Monochrome`, `Hybrid`, `Satellite`) | `Standard` |
| `AMAZON_LOCATION_ENABLE_MAPS` | Enable Maps V2 style/tile usage | `true` |
| `AMAZON_LOCATION_ENABLE_ROUTES` | Enable Routes V2 route/matrix/waypoint APIs | `true` |
| `AMAZON_LOCATION_ENABLE_TRACKERS` | Enable trackers (requires IAM/SigV4, not API key) | `false` |
| `AMAZON_LOCATION_ENABLE_GEOFENCES` | Enable geofences (requires IAM/SigV4, not API key) | `false` |
| `AMAZON_LOCATION_TRACKER_NAME` | Tracker resource name (used only with IAM/SigV4 mode) | _(empty)_ |
| `AMAZON_LOCATION_GEOFENCE_COLLECTION` | Geofence collection name (used only with IAM/SigV4 mode) | _(empty)_ |
| `AMAZON_LOCATION_TIMEOUT_MS` | API call timeout in milliseconds | `10000` |

## Database Bootstrap

Set `DB_AUTO_CREATE_TABLES=true` for TypeORM to auto-create tables on startup.

**⚠️ Never set `DB_DROP_AND_RECREATE=true` in production.**

### Seed Modes

- **`bootstrap`**: Creates essential data (vehicle types, system settings, super admin, admin)
- **`demo`**: Bootstrap + departments, demo users for all roles, employees, vehicles, drivers, routes, corridors, holidays

### Manual Scripts

```bash
npm run db:seed              # Uses SEED_MODE env
npm run db:seed:bootstrap    # Bootstrap only
npm run db:seed:demo         # Full demo data
npm run db:seed:clear        # Clear seedable tables
```

## Demo Credentials

All demo accounts use password from `DEMO_PASSWORD` (default: `password123`)

| Role | Email |
|---|---|
| Super Admin | `superadmin@transport.lk` |
| Admin | `admin@transport.lk` |
| HR | `hr@transport.lk` |
| Transport Authority | `ta@transport.lk` |
| HOD (Engineering) | `hod.eng@transport.lk` |
| HOD (Finance) | `hod.fin@transport.lk` |
| Planning | `planning@transport.lk` |
| Employee | `kamal@company.lk` (EMP-001) |

## API Summary

Swagger docs available at `http://localhost:3000/api/docs` when `ENABLE_SWAGGER=true`.

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/request-password-reset` - Request OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/reset-password` - Reset with OTP

### Public
- `GET /api/public/departments` - List departments

### Core CRUD
- `/api/users`, `/api/departments`, `/api/employees`, `/api/vehicles`, `/api/drivers`, `/api/routes`, `/api/corridors`, `/api/places`

### Workflow
- `POST /api/transport-requests` - Create request
- `POST /api/transport-requests/:id/submit` - Submit
- `POST /api/transport-requests/:id/admin-approve` - Admin approve
- `POST /api/transport-requests/:id/lock-daily-run` - Lock
- `POST /api/grouping/run/:requestId` - Run grouping
- `POST /api/approvals/hr/:requestId/approve` - HR approve

### Reports & Analytics
- `/api/reports/*`, `/api/analytics/*`, `/api/dashboard/*`

### Self Service
- `/api/self-service/overview`, `/api/self-service/issues`, `/api/self-service/location-change`

## Frontend Integration

The frontend connects via `VITE_API_BASE_URL`:

```env
# Frontend .env
VITE_API_BASE_URL=http://localhost:3000/api
```

If `VITE_API_BASE_URL` is not set, the frontend should run in demo/mock mode without crashing.

The backend does not depend on the frontend being present. They can be deployed separately.

## Production Notes

1. Change `JWT_SECRET` to a strong random string
2. Set `DB_AUTO_CREATE_TABLES=false` and use migrations
3. Set `DB_DROP_AND_RECREATE=false`
4. Set `SEED_ENABLED=false`
5. Set `CORS_ORIGIN` to your frontend domain
6. Use SSL for database connections
