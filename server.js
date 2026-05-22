require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const validator = require("validator");
const nodemailer = require("nodemailer");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 8000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "leads.sqlite3");
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@trufluxtech.com";

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    industry TEXT NOT NULL,
    title TEXT NOT NULL,
    interest TEXT NOT NULL,
    whitepaper TEXT,
    download_file TEXT,
    request_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function clean(value) {
  return String(value || "").trim();
}

function validateLead(body) {
  const lead = {
    name: clean(body.name),
    email: clean(body.email),
    industry: clean(body.industry),
    title: clean(body.title),
    interest: clean(body.interest),
    whitepaper: clean(body.whitepaper),
    downloadFile: clean(body.downloadFile),
    requestType: clean(body.requestType),
    createdAt: clean(body.createdAt)
  };

  const requiredFields = ["name", "email", "industry", "title", "interest", "requestType", "createdAt"];
  const missingFields = requiredFields.filter((field) => !lead[field]);

  if (missingFields.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Missing required fields: ${missingFields.join(", ")}`
    };
  }

  if (!validator.isEmail(lead.email)) {
    return {
      ok: false,
      status: 400,
      message: "Please enter a valid email address."
    };
  }

  return { ok: true, lead };
}

function saveLead(lead) {
  const statement = db.prepare(`
    INSERT INTO leads (
      name, email, industry, title, interest, whitepaper,
      download_file, request_type, created_at
    )
    VALUES (
      @name, @email, @industry, @title, @interest, @whitepaper,
      @downloadFile, @requestType, @createdAt
    )
  `);

  const result = statement.run(lead);
  return result.lastInsertRowid;
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

async function sendLeadEmail(lead, leadId) {
  if (!smtpConfigured()) {
    console.log("SMTP_HOST not configured. Email skipped.");
    return false;
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const useTls = String(process.env.SMTP_USE_TLS || "true").toLowerCase() === "true";

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      : undefined,
    requireTLS: useTls
  });

  const subject = `New Truflux Lead: ${lead.requestType}`;
  const text = `
New lead captured on Truflux Whitepapers page.

Lead ID: ${leadId}
Request Type: ${lead.requestType}
Name: ${lead.name}
Email: ${lead.email}
Industry: ${lead.industry}
Title: ${lead.title}
Area of Interest: ${lead.interest}
Whitepaper: ${lead.whitepaper || "-"}
Download File: ${lead.downloadFile || "-"}
Created At: ${lead.createdAt}
`.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || CONTACT_EMAIL,
    to: CONTACT_EMAIL,
    subject,
    text
  });

  return true;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "truflux-whitepapers-nodejs" });
});

app.post("/api/leads", async (req, res) => {
  const validation = validateLead(req.body);

  if (!validation.ok) {
    return res.status(validation.status).json({
      ok: false,
      message: validation.message
    });
  }

  try {
    const leadId = saveLead(validation.lead);
    let emailSent = false;

    try {
      emailSent = await sendLeadEmail(validation.lead, leadId);
    } catch (emailError) {
      console.error("Lead saved but email failed:", emailError.message);
    }

    return res.json({
      ok: true,
      leadId,
      emailSent
    });
  } catch (error) {
    console.error("Lead submission failed:", error);
    return res.status(500).json({
      ok: false,
      message: "Lead submission failed. Please try again."
    });
  }
});

app.get("/api/leads", (req, res) => {
  const adminKey = process.env.ADMIN_KEY;

  if (adminKey && req.headers["x-admin-key"] !== adminKey) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const rows = db.prepare(`
    SELECT id, name, email, industry, title, interest, whitepaper,
           download_file AS downloadFile, request_type AS requestType,
           created_at AS createdAt, inserted_at AS insertedAt
    FROM leads
    ORDER BY id DESC
    LIMIT 200
  `).all();

  res.json({ ok: true, leads: rows });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Truflux whitepapers app running on port ${PORT}`);
  });
}

module.exports = { app, validateLead };
