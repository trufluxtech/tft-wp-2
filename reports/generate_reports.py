#!/usr/bin/env python3
import argparse, csv, sqlite3
from pathlib import Path
from datetime import datetime

def fetch(conn, q):
    conn.row_factory = sqlite3.Row
    return [dict(r) for r in conn.execute(q).fetchall()]

def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8"); return
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader(); w.writerows(rows)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--db", default="leads.sqlite3")
    p.add_argument("--out", default="reports/output")
    args = p.parse_args()
    db = Path(args.db)
    out = Path(args.out)
    if not db.exists():
        raise FileNotFoundError(f"Database not found: {db}. Run npm start and submit at least one form first.")
    with sqlite3.connect(db) as conn:
        leads = fetch(conn, "SELECT * FROM leads ORDER BY id DESC")
        events = fetch(conn, "SELECT * FROM whitepaper_download_events ORDER BY id DESC")
        summary = fetch(conn, "SELECT whitepaper, COUNT(*) download_clicks, COUNT(DISTINCT email) unique_emails FROM whitepaper_download_events GROUP BY whitepaper ORDER BY download_clicks DESC")
    write_csv(out/"leads_report.csv", leads)
    write_csv(out/"download_events_report.csv", events)
    write_csv(out/"whitepaper_summary.csv", summary)
    text = ["Truflux Whitepapers Report", f"Generated: {datetime.now().isoformat(timespec='seconds')}", f"Leads: {len(leads)}", f"Download Events: {len(events)}", ""]
    text += [f"{r['whitepaper']}: {r['download_clicks']}" for r in summary] or ["No download events yet."]
    (out/"summary_report.txt").write_text("\n".join(text), encoding="utf-8")
    print(f"Reports generated in {out}")
if __name__ == "__main__":
    main()
