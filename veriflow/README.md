# 🛡️ VeriFlow Web Console (`Frontend/veriflow`)

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/MUI-5.x-007FFF?logo=mui&logoColor=white" alt="Material UI" />
  <img src="https://img.shields.io/badge/TanStack_Query-v5-FF4154?logo=reactquery&logoColor=white" alt="TanStack Query" />
</div>

<p align="center">
  <strong>Industrial Cryptographic Key Authority, Product Tag QR Studio, Work Shift Session Manager, and Real-Time Warehouse Audit Console.</strong>
</p>

---

## 🌟 Overview

**VeriFlow Web Console** is the administrative and operator command center for the **VeriFlow Offline-First QR Verification & Audit Platform**. It connects to the FastAPI backend (`jwt_api`) to manage RSA-2048/4096 signing keys, mint RS256 product tag QR codes and work shift tokens with custom expiration durations, configure dynamic inventory validation rules, and audit warehouse scan telemetry.

---

## ✨ Core Modules & Features

### 1. 📊 Executive Dashboard (`/dashboard`)
- **Real-Time Telemetry**: Live KPI cards for total scans, verification pass rate, active cryptographic keys, and active warehouse shifts.
- **Visual Analytics**: Hourly scan throughput charts, valid vs. rejected scan breakdowns (ECharts), and recent scan activity feed.

### 2. 🔑 Cryptographic Key Authority (`/keys`)
- **RSA Keypair Lifecycle**:
  - **Generate Keypair**: Create 2048-bit or 4096-bit RSA keys and assign ownership via a **User Dropdown** (selecting by user name + email and automatically capturing the user ID).
  - **Rotate Active Key**: Seamlessly rotate the primary signing key while keeping historical public keys active for verification.
  - **Revoke Key**: Immediately block a key from signing or verifying with an auditable revocation reason.
  - **Ownership-Scoped Key Deletion**:
    - **Admins (`keys.delete.any`)**: Can permanently delete any key (cascading associated shifts/rules).
    - **Normal Users (`keys.delete`)**: Can delete only keys they created for themselves (`Self-Created`), while Admin-assigned keys are visibly protected (`Admin-Assigned 🔒`).
- **Step-Up Authenticated Private Key Export**:
  - Admins can export a decrypted Private Key PEM after completing step-up verification (Account Password + 6-digit TOTP or Email OTP when MFA is active).
- **Issue RS256 Asymmetric JWT Modal**:
  - Select target user from the **User Dropdown** (auto-matching their active signing key), set a **custom numerical duration** in **Seconds, Minutes, Hours, Days, Weeks, Months, or Years**, and embed custom JSON claims.
- **Product Tag QR Engine (`tags.create`)**:
  - Generate RS256-signed product tag QR codes using either the **Standard Form** (`SKU`, `Batch No`, `Warehouse ID`) or **Raw JSON Payload** mode.
  - Supports custom expiration durations in **Seconds, Minutes, Hours, Days, Weeks, Months, or Years** and direct PNG download.
  - Built-in **Verify Tag / Scan QR Code** tab supporting live webcam scanning (`html5-qrcode`), QR image file upload, or raw JWT string inspection.
- **JWKS Viewer**: Inspect and copy the live JSON Web Key Set (`jwks.json`).

### 3. 📋 Inventory Validation Rules (`/rules`)
- Create, edit, toggle (`active` / `inactive`), and delete claim-matching rules (`EQUALS`, `CONTAINS`, `STARTS_WITH`, `IN_LIST`, `REGEX`, etc.).
- **User & Key Binding**: Select the rule owner via the **User Dropdown** — automatically filtering/matching that user's active cryptographic signing key so rules embed cleanly into their tokens.

### 4. ⏱️ Work Shifts & Scanner Sessions (`/shifts`)
- **Start New Work Shift Modal**:
  - **User Dropdown**: Select operator by name/email (captures `target_user_id` and auto-selects their active signing key).
  - **Custom Token / Shift Duration**: Enter any custom number and choose from **Seconds, Minutes, Hours, Days, Weeks, Months, or Years**, or click one of the quick preset chips (`60 Sec`, `30 Min`, `4 Hrs`, `8 Hrs (Std)`, `12 Hrs`, `24 Hrs`, `7 Days`, `1 Month`, `1 Year`).
  - **Shift Options**: Toggle `include_rules` (embeds active inventory rules into the shift JWT) and `qr_only` (renders a direct scannable PNG QR code from the API).
- **Reissue Active Shift Token**: Mint a fresh QR code and raw JWT for an active session at any time.
- **Ownership-Scoped Shift Deletion**:
  - **Admins (`shifts.delete.any`)**: Delete any shift from the table or by entering a Shift UUID.
  - **Normal Users (`shifts.delete`)**: Delete only shifts they started themselves (`Self-Created`); shifts assigned by an Admin are marked `Assigned by Admin 🔒`.

### 5. 🔍 Scan Audit Logs (`/scans`)
- Searchable, paginated verification audit log showing scan status (`VALID`, `INVALID_SIGNATURE`, `EXPIRED_TOKEN`, `RULE_VIOLATION`), operator, device ID, key ID (`kid`), and decoded payload claims.

### 6. 🛡️ Admin Console (`/admin`)
- Manage all registered operators, toggle account active status, and configure granular **RBAC Permissions** per user (including `keys.delete`, `keys.delete.any`, `shifts.delete`, `shifts.delete.any`, `tags.create`, and the Android SQLite wipe permission `user.delete_all_data`).

### 7. 👤 Profile & Multi-Factor Authentication (`/profile`)
- Configure **TOTP Authenticator App** (QR provisioning) or **Email OTP** 2FA, update account password, and inspect active session claims.

---

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript 5 + Vite 7 (SWC)
- **UI & Styling**: Material UI (MUI v5), Tailwind CSS / DaisyUI, Framer Motion
- **State & Data Fetching**: Zustand (persisted auth & session store) + TanStack Query v5 + Axios (with automatic cookie/bearer refresh interceptors)
- **QR & Cryptography Tools**: `qrcode` (canvas/dataURL generation) + `html5-qrcode` (camera & image file QR decoding)
- **Charts & Monitoring**: Apache ECharts + Sentry Error Boundary integration

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** `v18+`
- **npm** or **pnpm**
- Running instance of **VeriFlow Backend API (`jwt_api`)**

### 2. Install Dependencies

```bash
cd Frontend/veriflow
npm install
```

### 3. Configure Environment Variables

Create or update `.env` in `Frontend/veriflow/`:

```env
VITE_API_URL=http://localhost:8000/app/v1
```

> **Important CORS Note**: Ensure your frontend dev server origin (e.g. `http://localhost:5173` or `http://localhost:5174`) is listed in `jwt_api/.env` under `ALLOWED_ORIGINS`. The backend loads `ALLOWED_ORIGINS` strictly from `jwt_api/.env`.

### 4. Start Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

---

## 📁 Project Structure

```text
Frontend/veriflow/src/
├── api/                  # Axios client, auth refresh interceptors, toast utilities
├── components/           # Shared UI components (Table, OtpBoxesInput, Navbar, Sidebar)
├── config/               # RBAC permission metadata (permissionsMetadata.ts) & constants
├── context/              # Theme & application context providers
├── HOCS/                 # Route guards & authentication higher-order components
├── pages/
│   ├── Admin/            # User management & granular RBAC permission matrix
│   ├── Dashboard/        # Real-time warehouse scan analytics & ECharts
│   ├── Keys/             # RSA key authority, RS256 token issuer, Product Tag QR studio
│   ├── Login/            # Login & MFA challenge verification (TOTP / Email OTP)
│   ├── Profile/          # User profile, password, and MFA setup
│   ├── Rules/            # Dynamic claim-matching inventory rules engine
│   ├── Scans/            # Warehouse scan verification & audit logs
│   └── Shifts/           # Work shift sessions, custom duration tokens, QR modal
├── routes/               # Application route definitions
├── store/                # Zustand authStore (user profile, roles, permissions)
└── App.tsx               # Root application component
```

---

**Built with ❤️ by Talha (`iotNoob`)**
