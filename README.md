# DSI Transport Management System

Enterprise overtime staff **drop-off** dispatch and operations management platform.

## Overview

- Daily transport request lifecycle (HOD → Admin → TA → HR → Dispatch)
- Automatic route grouping with Amazon Location Service integration
- Vehicle & driver assignment with capacity management
- Multi-role access (Super Admin, Admin, HOD, HR, Transport Authority, Planning, Employee)
- Operational reports (Route-Wise, Vehicle-Wise, Cost Summary, Dispatch Manifest, etc.)
- Multilingual UI (English, Sinhala, Tamil)

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React · TypeScript · Vite · Tailwind CSS · shadcn/ui |
| Backend   | NestJS · TypeORM · PostgreSQL |
| Maps      | Amazon Location Service V2 · MapLibre GL |
| Hosting   | Railway |

## Development

```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
npm install
npm run start:dev
```

## Environment Variables

See `backend/.env.example` for required configuration.

## License

Proprietary — DSI Internal Use Only.
