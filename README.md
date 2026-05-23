# Truflux Whitepapers Clean Install v1.4.2

No email integration. Everything is captured in SQLite.

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:8000
```

## Reports in index.html

Click **Reports** in the landing page.

Default report password:

```text
test123
```

To change it, create `.env`:

```text
ADMIN_KEY=your-password
DB_PATH=leads.sqlite3
```

## Tables

- `leads`
- `whitepaper_download_events`

## CSV export

After login in Reports, use the CSV buttons.

Direct URLs:

```text
/api/export/leads.csv?key=test123
/api/export/download-events.csv?key=test123
```

## Python report

After submitting at least one form:

```bash
python3 reports/generate_reports.py --db ./leads.sqlite3
```

## Railway

Set only:

```text
ADMIN_KEY=your-secure-password
```

No SMTP variables are needed.
