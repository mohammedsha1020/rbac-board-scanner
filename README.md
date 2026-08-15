# Classroom Board Scanner & RBAC Management Portal

This workspace contains the complete production-grade codebase for a secure classroom board scanner application with a three-level Role-Based Access Control (RBAC) authorization hierarchy.

## Project Structure

```
d:/tg-app/
├── backend/            # Express, TypeScript, & Prisma (PostgreSQL) REST API service
├── frontend/           # Flutter (Material 3) clean architecture mobile application
└── demo/               # Web-based visual prototype and telemetry simulation server
```

---

## 1. Backend Service Setup

The backend utilizes Node.js, Express, TypeScript, and Prisma ORM to interact with PostgreSQL.

### Dependencies
- Node.js (v20+)
- PostgreSQL (or Docker Compose to launch a local alpine container)

### Quick Start
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Setup database container:
   ```bash
   docker-compose up -d
   ```
3. Initialize configurations:
   - Copy `.env.example` to `.env`
   - Adjust the `DATABASE_URL` and `JWT_SECRET` if needed.
4. Install npm packages:
   ```bash
   npm install
   ```
5. Deploy Database Migrations and load the seeds (creates L1 `basic`, L2 `admin`, L3 `god` accounts):
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```
6. Start development server (running on port `5000` by default):
   ```bash
   npm run dev
   ```

---

## 2. Flutter Mobile Setup

The client app is built on Flutter, modularized by features using Clean Architecture principles and Riverpod.

### Key Configs
- **Offline First**: All directories and captures are indexed locally in SQLite (`path` + `sqflite` + `sqlite_helper.dart`).
- **Private Sandbox Storage**: Files are saved directly to `getApplicationDocumentsDirectory()`, hidden from the system Media Gallery (prevents indexing).
- **Edge Extraction & Filters**: Custom Dart pixel subtraction algorithms execute shadow division, contrast stretch, and sharp contrast math.

### Compiling and Launching
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Dart packages:
   ```bash
   flutter pub get
   ```
3. Build or run for Android devices / emulator:
   ```bash
   flutter run -d android
   ```
4. Build release APK bundle:
   ```bash
   flutter build apk --release
   ```

---

## 3. Interactive Telemetry Demonstration

To test the security policies and see the whiteboard image adjustments in action without setting up physical Android hardware, we built a simulated environment.

1. Navigate to the demo directory:
   ```bash
   cd demo
   ```
2. Install simulation dependencies:
   ```bash
   npm install
   ```
3. Run local server:
   ```bash
   node demo_server.js
   ```
4. Access the portal at: **[http://localhost:3000](http://localhost:3000)**
   - Swap active accounts between **John (Basic)**, **Clark (Admin)**, and **System (God)**.
   - Capture mock blackboard/whiteboard panels, apply the shadow subtraction filter, and watch the central console register logs in real time.
