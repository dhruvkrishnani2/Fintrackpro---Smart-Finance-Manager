# FinTrack Pro

A full-stack personal finance manager with real analytics, a Gemini-powered chat assistant, bank statement import with auto-categorization, and shared family accounts — built with FastAPI, React, PostgreSQL, and scikit-learn.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Quick Start (Docker)](#quick-start-docker)
  - [Manual Setup](#manual-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

FinTrack Pro is a complete personal finance platform, not just a transaction ledger. It covers authentication (with optional 2FA and Google Sign-In), budgeting, savings goals, recurring transactions, bank statement import with ML-assisted categorization, shared family finances, PDF/Excel reporting, and a natural-language chat assistant that answers questions about your real financial data — never invented numbers.

## Features

### Core finance tracking
- Income/expense transactions with categories, sources, and recurring flags
- Category-wise monthly budgets with overspend detection
- Savings goals with contribution tracking and progress
- Dashboard with total balance, monthly income/expense/savings, and net cash flow
- Trend charts (income vs. expense, category breakdown) via Chart.js
- Cash flow forecasting using a scikit-learn linear regression model over transaction history

### Authentication & security
- JWT-based auth with bcrypt password hashing
- **Two-factor authentication (TOTP)** — scan a QR code into any authenticator app; login becomes password → temp token → 6-digit code → access token
- **Google Sign-In** via Google Identity Services

### AI finance assistant (`/assistant`)
Ask free-form questions like *"how much did I spend on food this month?"* or *"am I over budget?"* The assistant answers only with numbers pulled live from your own data via tool-calling — it can't invent figures.

- **Online mode**: powered by Gemini (`google-genai`), using function calling against read-only data endpoints (balance, period summary, category spend, budget status, goals, forecast, recent transactions)
- **Offline mode**: a deterministic keyword-matching engine with zero external dependency
- Automatic graceful fallback to offline mode if no API key is configured or a request fails, so the assistant never just breaks
- Conversation history saved per user

### Bank statement import
- Upload a `.csv` or `.xlsx` statement; columns are auto-detected across common export formats (Date/Description/Amount or Date/Description/Debit/Credit)
- Two-pass auto-categorization: keyword rules (e.g. "swiggy" → Food, "uber" → Travel) followed by a Naive Bayes classifier trained live on the user's own categorized history
- Editable preview — nothing is written to the database until confirmed

### Family / shared accounts
- Create a family (become admin) or join one via an 8-character invite code
- Admins can regenerate invite codes, promote members, and remove members
- Combined read-only dashboard aggregating each member's own income/expense/savings — no transaction data is merged or reassigned

### Reporting
- Export the transaction ledger (filterable by month, year, type) as `.xlsx` or `.pdf`
- Full financial report export — summary, category breakdown, monthly trend, budgets, goals, and transactions — as a multi-sheet workbook or formatted PDF

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, Pydantic, Alembic-ready |
| Database | PostgreSQL |
| Frontend | React, Tailwind CSS, Chart.js |
| Auth | JWT, bcrypt, TOTP (pyotp), Google Identity Services |
| Data/ML | pandas, scikit-learn (forecasting), Naive Bayes (auto-categorization) |
| AI Assistant | Google Gemini (`google-genai`) with function calling |
| Reporting | openpyxl, reportlab |
| Deployment | Docker, Elastic Beanstalk, Amplify |

## Project Structure

```
fintrack-pro/
├── backend/
│   ├── app/
│   │   ├── routers/        auth, transactions, budgets, goals, analytics,
│   │   │                   categories, imports, family, chatbot, reports, recurring
│   │   ├── chatbot.py       offline rule-based assistant engine
│   │   ├── llm_chatbot.py   Gemini-powered assistant engine
│   │   ├── finance_data.py  shared read-only data functions used by both engines
│   │   ├── categorizer.py   auto-categorization (keyword rules + Naive Bayes)
│   │   ├── models.py / schemas.py / database.py / config.py / auth.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           Dashboard, Transactions, Budgets, Goals,
│   │   │                    Chatbot, Settings, Login, Register
│   │   ├── context/          AuthContext
│   │   └── api/client.js
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## Getting Started

### Quick Start (Docker)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

### Manual Setup

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL to your local Postgres instance
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

**`backend/.env`**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret — set a long random value in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token lifetime |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |
| `GEMINI_API_KEY` | Optional — enables the online AI assistant. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Optional, defaults to `gemini-3.5-flash` |
| `GOOGLE_CLIENT_ID` | Optional — enables Google Sign-In |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_GOOGLE_CLIENT_ID` | Must match `GOOGLE_CLIENT_ID` on the backend |

> The AI assistant and Google Sign-In are both optional — the app runs fully without either, with the chatbot falling back to its offline engine automatically.

## Deployment
### Frontend (AWS Amplify)
- Deploy the React (Vite) application to AWS Amplify.
- Configure environment variables:
`VITE_API_URL`
`VITE_GOOGLE_CLIENT_ID`
- Redeploy the application after updating environment variables.
- Backend (AWS Elastic Beanstalk)
- Deploy the FastAPI backend to Elastic Beanstalk.

Configure environment properties:
`DATABASE_URL`
`SECRET_KEY`
`GOOGLE_CLIENT_ID`
`GEMINI_API_KEY`
`FRONTEND_URL`
`CORS_ORIGINS`

- Restart the application after saving changes.
- 
### Database
- Create a PostgreSQL database (AWS RDS or local).
- Update the DATABASE_URL in the backend.

### CloudFront
- Create a CloudFront distribution with the Elastic Beanstalk application as the origin.
- Configure HTTPS and use the CloudFront URL as the frontend API endpoint.
- Update VITE_API_URL with the CloudFront URL and redeploy Amplify.

### Google OAuth
- Create an OAuth 2.0 Client ID in Google Cloud Console.
- Add the Amplify domain to Authorized JavaScript Origins.
- Add the backend callback URL to Authorized Redirect URIs (if applicable).
- Copy the Client ID to both frontend and backend environment variables.

### Verification
- Verify the backend is accessible via /docs.
- Test database connectivity.
- Test user registration and login.
- Verify Google Sign-In works successfully.
- Test AI features powered by the Gemini API.

## License

MIT
