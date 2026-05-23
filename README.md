# VerifyChain 🔐
### Product Authenticity Infrastructure for the Physical World

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![Status](https://img.shields.io/badge/status-production--ready-green.svg)]()
[![Stack](https://img.shields.io/badge/Stack-Fullstack%20%7C%20Supabase%20%7C%20AI-orange.svg)]()

> "Every product deserves a provable identity — scan once, verify instantly, trust forever."

---

## 📸 Product Showcase

| **The Vision** | **The Process** |
|:---:|:---:|
| ![Landing](assets/images/home1.jpg) | ![How It Works](assets/images/home2.jpg) |
| *Landing — Every Product. Provably Real.* | *Scan Any Product. Know It's Real.* |

| **The Problem** | **The Verification** |
|:---:|:---:|
| ![The Problem](assets/images/home3.jpg) | ![Buyer Verification](assets/images/home4.jpg) |
| *Counterfeits are destroying trust globally.* | *Verified Authentic Certificate.* |

| **The Dashboard** | **The Detection** |
|:---:|:---:|
| ![Seller Dashboard](assets/images/home5.jpg) | ![Counterfeit Detection](assets/images/home6.jpg) |
| *Generate Encrypted QR Batches.* | *Not Registered / Fraud Result.* |

| **Future Vision** | **Architecture Overview** |
|:---:|:---:|
| ![Vision](assets/images/home7.jpg) | ![Platform Overview](assets/images/home8.jpg) |
| *The Future of Commerce is Provably Authentic.* | *Scalable Infrastructure for Global Supply Chains.* |

---

## 🛑 The Problem: A $4.5 Trillion Crisis

Fake products are not a minor inconvenience — they are an existential threat to businesses that depend on quality and trust.

*   **Global Economic Impact:** **$4.5 trillion** lost to counterfeit goods annually.
*   **Regional Devastation:** **70%** of "Kashmiri saffron" sold online is fake. Real farmers lose income while fraudsters profit.
*   **Artisanal Theft:** A carpet weaver in Budgam has no way to prove his handwoven carpet is authentic, while mass-produced fakes make the same claim.
*   **Lethal Consequences:** Pharmaceutical counterfeits kill over **1 million people annually** due to lack of verification at the point of sale.

### Why Businesses Must Adapt
A business selling premium products — saffron, Pashmina, medicine — with no way to prove authenticity is one viral scandal away from collapse. The businesses that survive the next decade will be the ones that can **prove** what they sell is real.

---

## 🇪🇺 The Regulatory Tailwind: EU Digital Product Passport (DPP)
The **EU DPP** regulation mandates that every physical product sold in Europe must carry a verifiable digital identity by **2026**.

**VerifyChain is compliance infrastructure.** We don't help businesses adapt to the future — we *are* the infrastructure they are legally required to adopt.

---

## 💡 What is VerifyChain?
VerifyChain gives every physical product a cryptographically signed digital identity — a unique, encrypted QR code that allows anyone to instantly verify:

*   ✅ **Authenticity:** Is this product real or a replica?
*   ✅ **Provenance:** Where did it originate?
*   ✅ **Chain of Custody:** Who handled it, and when?
*   ✅ **Integrity:** Has this QR been tampered with or duplicated?

**No app required. Works on any phone. Verification in under 2 seconds.**

---

## 🛠️ Core Features

### 1. Cryptographic QR Identity System
HMAC-SHA256 signed QR codes — each unit gets a **unique token** (UUID `jti` + random nonce). No two tags are identical.
*   **One-Time Seal** — first scan authenticates; re-scans blocked.
*   **Limited Scans** — configurable max verifications per tag.
*   **Category-themed** printable tag sheets with fingerprint IDs.
*   Server-side registry enforcement (token must exist in `qr_tokens`).
*   Scannable with any smartphone camera — no app required.

### 2. AI-Powered Fraud Detection
Real-time pattern analysis on every scan event. The system flags:
*   **Geographic Anomaly:** Same QR scanned in two distant locations simultaneously.
*   **Velocity Anomaly:** Abnormal scan counts (e.g., 100 scans/min).
*   **Retail Inconsistency:** Patterns inconsistent with legitimate consumer behavior.

### 3. Full Supply Chain Traceability
End-to-end recording: **Farm → Processor → Distributor → Seller → Buyer**. Complete chain of custody with timestamps and verified locations.

### 4. Seller Dashboard & Analytics
*   Register batches and generate printable PDF QR tag sheets.
*   Real-time global scan map.
*   Fraud alerts and batch-level performance analytics.

### 5. EU DPP Export
Generate regulatory-compliant data exports for EU systems — essential for any exporter targeting the European market.

---

## ⚙️ Technical Implementation

### QR Generation Flow
1. **Registration:** Seller registers a batch in the dashboard.
2. **Secret Generation:** System creates a batch ID and HMAC secret.
3. **Payload Construction:** Payload contains `bid`, `uid`, `pid`, and `ts`.
4. **Signing:** Payload is signed using **HMAC-SHA256**.
5. **Encoding:** Signed payload is encoded into a secure token.
6. **QR Rendering:** Token is embedded in a URL and rendered as a QR code.

### Verification Flow
1. **Scan:** User scans the QR code.
2. **Routing:** URL routes to the verification engine.
3. **Validation:** Supabase Edge Function validates the signature server-side.
4. **Check:** Product, seller, and scan data are cross-referenced.
5. **Result:** User receives a cryptographic proof of authenticity or a fraud warning.

---

## 🏗️ Architecture & Stack

### Stack
*   **Frontend:** HTML5, Vanilla CSS, Modular ES6+ JavaScript
*   **Backend:** Node.js + Express
*   **Database/Auth:** Supabase (PostgreSQL, Realtime)
*   **Serverless Logic:** Supabase Edge Functions (Deno)
*   **AI Engine:** Gemini API (Fraud Enrichment) + Rule-based Fallback
*   **Deployment:** Render Blueprint

### Architecture Diagram
```text
[ Physical Product ] -> [ Encrypted QR ] -> [ Smartphone Scan ]
                                                  |
                                                  v
[ Supabase Edge Function ] <-> [ PostgreSQL DB ] <-> [ AI Fraud Engine ]
           |                          |                      |
           v                          v                      v
[ Cryptographic Proof ]    [ Chain of Custody ]    [ Risk Assessment ]
```

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Supabase Account
*   Gemini API Key (Optional, for AI fraud features)

### Local Setup
1. **Clone the repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your Supabase and API credentials.
4. **Launch Development Server:**
   ```bash
   npm start
   ```
5. **Access the App:**
   Open `http://127.0.0.1:4173`

### Database Setup
1. Execute the SQL schema found in `supabase/schema.sql` within your Supabase SQL Editor.
2. Deploy the edge function:
   ```bash
   supabase functions deploy verify-qr --no-verify-jwt
   ```

---

## 🔭 The Vision
VerifyChain is not just anti-counterfeit tooling. It is **authenticity and compliance infrastructure** for future-proof businesses.

> "Future-proof businesses won't just sell products. They'll prove them."

---
*VerifyChain — Product Authenticity Infrastructure*
