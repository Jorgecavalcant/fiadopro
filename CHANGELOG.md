# Changelog — FiadoPro

All notable changes to the FiadoPro project are documented in this file.

---

## [1.0.0] — March 2026

### Initial Release

This is the first public release of FiadoPro, a mobile-first credit management app for small business owners ("fiado" = selling on credit in Brazil).

### Features

**Core**
- Customer registration with name, phone, email, PIX key, and notes
- Debt (fiado) recording with description and timestamp
- Payment registration with method (PIX, cash, credit/debit card, compensation)
- Refund/return tracking with automatic "A Pagar" (To Pay) flag
- Abatimento (non-monetary payment) support

**Finance**
- Real-time customer balance calculation
- Overdue detection
- Receivables and debtors list views
- Installment purchases (2–24x) with optional compound monthly interest
- Revenue evolution area chart (last 14 days)
- Distribution pie chart (balance by status)

**Credit Score**
- Automatic 0–1000 credit score per customer
- Categories: Excelente (≥800), Bom (600–799), Regular (400–599), Ruim (<400)
- Score detail view with breakdown

**Events (Racha)**
- Bill-splitting event management
- Participant item assignment
- Automatic per-person debt calculation
- Owner expense tracking

**AI Insights (PRO)**
- Per-customer AI payment behavior analysis
- General business AI advice (global insights)

**Notifications**
- Pending payment approval/rejection workflow

**Audit Log**
- Full action audit trail for all create/update/delete operations

**Profile & Settings**
- Owner profile with PIX key, address, default interest rate
- Data export (JSON backup) and import
- Account deletion

**Plans**
- Free: up to 20 customers, 3 events
- PRO: up to 500 customers, unlimited events, AI Insights, no ads

**UX**
- Mobile-first responsive layout (2-col KPI grid on mobile, 4-col on desktop)
- Dark sidebar navigation with collapsible desktop mode
- Floating Action Button (FAB) for quick debt/payment entry
- WhatsApp sharing of customer statement
- Printable customer statement
- Portuguese (pt-BR) and English (en) language support
- Password-protected login with PBKDF2 hashing

**Help & Support**
- In-app manual with 15 step-by-step guides
- FAQ section with 8 common questions
- Direct support email link

---

## Notes

- Data is stored entirely in `localStorage` (no server-side persistence required for client data)
- Built with React 18, TypeScript, Vite, TailwindCSS, Recharts, Lucide React
- Deployed via Docker + Nginx on Hetzner VPS
