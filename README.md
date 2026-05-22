# Truflux Whitepapers - Node.js Railway Version

This version replaces the Python/FastAPI backend with a Node.js architecture.

## Architecture

- Frontend: Static HTML/CSS/JavaScript served from `public/`
- Backend: Node.js + Express
- Database: SQLite via `better-sqlite3`
- Email: Nodemailer
- Deployment: Railway using Nixpacks

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:8000
```

## Test

```bash
npm test
```

## Railway deployment

1. Push this folder to GitHub.
2. Railway → New Project → Deploy from GitHub.
3. Railway will use:
   ```bash
   npm start
   ```
4. Generate a public domain from Railway Networking.

## Environment variables

Set these in Railway:

```text
CONTACT_EMAIL=contact@trufluxtech.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=your-email@gmail.com
SMTP_USE_TLS=true
ADMIN_KEY=change-this-admin-key
```

If SMTP variables are not configured, leads are still stored in SQLite and email is skipped.

## Lead capture endpoint

```text
POST /api/leads
```

## Health check

```text
GET /api/health
```

## Admin lead view

```text
GET /api/leads
```

If `ADMIN_KEY` is set, call it with:

```text
x-admin-key: your-admin-key
```

## Whitepaper PDFs

Replace placeholder PDFs inside:

```text
public/whitepapers/
```


## Railway build fix

This package includes `nixpacks.toml` to force:

```text
Node.js 20
Python 3.11
gcc
gnumake
pkg-config
```

This fixes the Railway error where Node 24 was selected and `better-sqlite3` failed during native build.

If Railway still uses Node 24, manually add this Railway variable:

```text
NODE_VERSION=20
```

Then redeploy.
