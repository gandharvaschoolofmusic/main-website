<div align="center">

# 🎵 Gandharva School of Music — Live 1:1 Learning Platform

**Accredited Live 1:1 Online Music & Dance Academy Platform**  
*Built with Next.js 16, React 19, LiveKit WebRTC, Prisma ORM, and Supabase PostgreSQL.*

[![Production](https://img.shields.io/badge/Production-Live-success?style=flat-square&logo=vercel)](https://www.gandharvaschoolofmusic.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-FF4F00?style=flat-square&logo=webrtc)](https://livekit.io/)
[![Firebase](https://img.shields.io/badge/Firebase-Phone%20Auth-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)

**[🌐 Visit Live Website](https://www.gandharvaschoolofmusic.com)** &nbsp;•&nbsp; **[📖 Project Summary](./PROJECT_SUMMARY.md)**

</div>

---

## 🌟 Overview

The **Gandharva School of Music Platform** is an enterprise-grade, high-fidelity learning management and virtual studio system. It connects students across the globe with accredited maestros for live, interactive, 1-on-1 sessions across Indian classical instruments, western contemporary instruments, classical and modern vocal disciplines, and classical dance forms.

The platform complies with international syllabus guidelines including **Trinity College London**, **ABRSM (Associated Board of the Royal Schools of Music)**, and **Akhil Bharatiya Gandharva Mahavidyalaya Mandal**.

---

## 🚀 Key Features

### 🎙️ 1. Studio-Grade Virtual Classroom
- **Real-Time WebRTC Audio & Video**: Powered by LiveKit with custom audio constraints engineered specifically for acoustic instruments (stereo channels, echo cancellation toggle, high bitrate).
- **Interactive Teacher-Student Toolkit**:
  - Digital interactive **Metronome** with customizable tempo, time signatures, and visual beats.
  - Live **Pitch Monitor & Instrument Tuner** for real-time intonation feedback.
  - Interactive **Collaborative Whiteboard** for notation review and pedagogical annotation.
  - Dual-stream **Screen Sharing** and high-definition video feeds.
  - In-session multi-track **Audio/Video Studio Recording**.

### 📅 2. Dynamic Booking & Trial Session Engine
- **Instant 1:1 Live Trial Booking**: Frictionless multi-step booking flow with instrument choice, maestro selection, and real-time slot selection.
- **Timezone Intelligence**: Bi-directional viewer timezone translation ensuring teachers and students worldwide see accurate schedules in their local time.
- **Automated Calendar Synchronization**: Instant `.ics` calendar invitation generation and delivery via email for both student and teacher.

### 🔐 3. Authentication & Security
- **Firebase Phone OTP Authentication**:
  - Instant mobile SMS verification with Google reCAPTCHA pre-warming (< 1s dispatch).
  - Parallel server pre-validation and fast-path cryptographic JWT decoding (0ms verification).
  - Automatic error reset with tactile shake animations (`animate-shake`).
- **Passwordless Email Verification**: Secure email verification tokens and Google Identity Toolkit REST API integration.
- **Role-Based Access Control (RBAC)**: Distinct permissions and portal experiences for `ADMIN`, `TEACHER`, and `STUDENT`.
- **Brute-Force Rate Limiting**: Intelligent IP- and phone-based rate limiters across all authentication checkpoints.

### 🏛️ 4. Multi-Role Portals & Management
- **Admin Command Desk**: User directory, teacher application review & vetting, transaction ledger, curriculum publishing, and direct live support desk.
- **Faculty Studio**: Schedule & recurring weekly availability manager, student roster, lesson logs, homework assignments, and payout tracking.
- **Student Learning Hub**: Lesson dashboard, 1-click room launch, recording archive, course progress, and accredited credentials.

### 🎓 5. Course Catalog & Automated Certification
- **Accredited Curriculum**: Structured masterclasses for Piano, Guitar, Violin, Tabla, Sitar, Flute, Hindustani & Carnatic Vocals, Kathak, and Bharatanatyam.
- **Verifiable Digital Credentials**: Automated high-resolution PDF certificate generation powered by `pdf-lib` featuring cryptographic QR-code verification.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16.3** | App Router, Server Actions, Turbopack, Streaming SSR |
| **UI & Core** | **React 19.2** | React Server Components (RSC), `useActionState`, Transitions |
| **Language** | **TypeScript 5** | Strict type safety across server and client boundaries |
| **Styling** | **Tailwind CSS v4** | Gandharva luxury tokens (Saffron `#FF7703`, Purple `#9506EE`, Deep Violet `#12072B`) |
| **ORM & Database** | **Prisma 7.10 + Supabase** | PostgreSQL 16 hosted on Supabase (connection pooler) |
| **Real-Time Video/Audio** | **LiveKit WebRTC** | `livekit-client`, `@livekit/components-react`, `livekit-server-sdk` |
| **Phone Authentication** | **Firebase Auth** | Client-side SDK (Phone OTP) + Serverless REST Toolkit |
| **Session Management** | **Auth.js (NextAuth v5 beta)** | Credentials & JWT session cookies with secure cross-origin support |
| **Email Delivery** | **Resend / Firebase** | Branded transactional emails with automatic fallback |
| **Payment Gateway** | **Razorpay** | Multi-currency (INR, USD, EUR, GBP) dynamic checkout |
| **Document Engine** | **pdf-lib & qrcode** | On-the-fly accredited certificate compilation & QR stamping |

---

## 📦 Project Structure

```
├── prisma/
│   ├── schema.prisma        # Complete PostgreSQL database schema
│   ├── seed.ts              # Full development seed script
│   └── seed-admin.ts        # Clean production seed (Admin + Platform settings only)
├── public/                  # Static assets, branding, and multi-resolution favicons
├── src/
│   ├── actions/             # Next.js Server Actions (Auth, Booking, Admin, Lessons, Support)
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Authentication routes (Login, Signup, Verify, Reset)
│   │   ├── admin/           # Platform Administration Desk
│   │   ├── book-trial/      # Free 1:1 Live Trial booking wizard
│   │   ├── courses/         # Masterclasses & curriculum catalog
│   │   ├── room/            # LiveKit WebRTC studio classroom
│   │   ├── student/         # Student learning portal & dashboard
│   │   ├── teacher/         # Faculty scheduling & teaching studio
│   │   ├── layout.tsx       # Root layout & brand metadata
│   │   └── page.tsx         # Gandharva homepage & showcase
│   ├── components/          # Reusable UI components & luxury design widgets
│   ├── context/             # Global React contexts (Currency, Viewer Timezone)
│   ├── lib/                 # Core utilities (LiveKit, Firebase, Prisma, Auth, Email, Logging)
│   └── schemas/             # Zod validation schemas
├── .env.example             # Documented environment variable template
├── package.json             # Dependencies and build scripts
└── tsconfig.json            # Strict TypeScript configuration
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20.x or later (v24 LTS recommended)
- **Package Manager**: `npm`
- **PostgreSQL Database**: Local PostgreSQL, Docker container, or cloud Supabase instance

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/gandharvaschoolofmusic/main-website.git
cd main-website
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the essential credentials:
```env
# Database (PostgreSQL / Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# NextAuth / Auth.js
AUTH_SECRET="generate-a-strong-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Firebase (Phone Authentication & SMS)
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"

# LiveKit (Virtual Classroom Audio/Video)
LIVEKIT_API_KEY="your-livekit-api-key"
LIVEKIT_API_SECRET="your-livekit-api-secret"
NEXT_PUBLIC_LIVEKIT_URL="wss://your-project.livekit.cloud"
```

### 4. Push Database Schema & Seed Admin
```bash
# Push schema migrations to database
npx prisma db push

# Seed production administrator account
npm run db:seed:admin
```

> **Default Seed Administrator Account:**
> - **Email**: `admin@gandharvaschoolofmusic.com`
> - **Password**: `Admin@Gandharva2026!`

### 5. Launch Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🛠️ Useful Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server with Turbopack |
| `npm run build` | Generates Prisma client and creates optimized production build |
| `npm run start` | Boots the compiled production server |
| `npx tsc --noEmit` | Runs full static TypeScript type-checking across all files |
| `npm run db:seed:admin` | Seeds clean platform settings & production administrator |
| `npm run db:studio` | Opens interactive Prisma Studio GUI in browser |
| `npx prisma db push` | Pushes local Prisma schema directly to connected database |

---

## 🔒 Security Best Practices

1. **Zero Raw Password Storage**: Passwords are cryptographically salted and hashed using Argon2 / BCrypt.
2. **Encrypted Phone Verification**: Client verification is backed by Google Identity Toolkit signed tokens validated before any user write.
3. **Multi-Tenant Protection**: Database operations are guarded by atomic transactions (`db.$transaction`) with role-based checks preventing unauthorized resource access.
4. **Environment Isolation**: Production secrets and database connections are stored exclusively in Vercel environment variables, never committed to git.

---

## 📄 License & Attribution

Copyright © 2026 **Gandharva School of Music**. All rights reserved.  
Curriculum accreditations and logos are registered trademarks of their respective examination boards (Trinity College London, ABRSM, and ABGMV).
