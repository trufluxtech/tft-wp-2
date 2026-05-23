require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const validator = require("validator");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 8000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "leads.sqlite3");
const ADMIN_KEY = process.env.ADMIN_KEY || "test123";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS leads (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,email TEXT NOT NULL,industry TEXT NOT NULL,title TEXT NOT NULL,interest TEXT NOT NULL,
 whitepaper TEXT,download_file TEXT,request_type TEXT NOT NULL,created_at TEXT NOT NULL,
 user_agent TEXT,ip_address TEXT,inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS whitepaper_download_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 lead_id INTEGER,name TEXT,email TEXT,industry TEXT,title TEXT,interest TEXT,
 whitepaper TEXT NOT NULL,download_file TEXT NOT NULL,event_type TEXT NOT NULL,
 user_agent TEXT,ip_address TEXT,created_at TEXT NOT NULL,inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

function clean(v){ return String(v || "").trim(); }
function ip(req){ return clean(req.headers["x-forwarded-for"] || req.socket.remoteAddress); }
function ua(req){ return clean(req.headers["user-agent"]); }

function validateLead(body){
 const lead={name:clean(body.name),email:clean(body.email),industry:clean(body.industry),title:clean(body.title),interest:clean(body.interest),whitepaper:clean(body.whitepaper),downloadFile:clean(body.downloadFile),requestType:clean(body.requestType),createdAt:clean(body.createdAt)};
 const missing=["name","email","industry","title","interest","requestType","createdAt"].filter(k=>!lead[k]);
 if(missing.length) return {ok:false,status:400,message:`Missing required fields: ${missing.join(", ")}`};
 if(!validator.isEmail(lead.email)) return {ok:false,status:400,message:"Please enter a valid email address."};
 return {ok:true,lead};
}
function validateDownloadEvent(body){
 const event={leadId:body.leadId?Number(body.leadId):null,name:clean(body.name),email:clean(body.email),industry:clean(body.industry),title:clean(body.title),interest:clean(body.interest),whitepaper:clean(body.whitepaper),downloadFile:clean(body.downloadFile),eventType:clean(body.eventType||"Whitepaper Download Click"),userAgent:clean(body.userAgent),ipAddress:clean(body.ipAddress),createdAt:clean(body.createdAt||new Date().toISOString())};
 if(!event.whitepaper || !event.downloadFile) return {ok:false,status:400,message:"whitepaper and downloadFile are required."};
 return {ok:true,event};
}
function saveLead(lead){
 return db.prepare(`INSERT INTO leads (name,email,industry,title,interest,whitepaper,download_file,request_type,created_at,user_agent,ip_address)
 VALUES (@name,@email,@industry,@title,@interest,@whitepaper,@downloadFile,@requestType,@createdAt,@userAgent,@ipAddress)`).run(lead).lastInsertRowid;
}
function saveEvent(event){
 return db.prepare(`INSERT INTO whitepaper_download_events (lead_id,name,email,industry,title,interest,whitepaper,download_file,event_type,user_agent,ip_address,created_at)
 VALUES (@leadId,@name,@email,@industry,@title,@interest,@whitepaper,@downloadFile,@eventType,@userAgent,@ipAddress,@createdAt)`).run(event).lastInsertRowid;
}
function requireAdmin(req,res,next){
 const key=req.headers["x-admin-key"] || req.query.key;
 if(String(key||"")!==String(ADMIN_KEY)) return res.status(401).json({ok:false,message:"Unauthorized"});
 next();
}
function csv(rows, fallbackCols){
 const cols=rows.length?Object.keys(rows[0]):fallbackCols;
 return [cols.join(","),...rows.map(r=>cols.map(c=>JSON.stringify(r[c]??"")).join(","))].join("\n");
}

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"truflux-whitepapers-clean",version:"1.4.0",emailIntegration:false}));
app.post("/api/leads",(req,res)=>{
 const v=validateLead(req.body); if(!v.ok) return res.status(v.status).json({ok:false,message:v.message});
 const lead={...v.lead,userAgent:ua(req),ipAddress:ip(req)};
 const leadId=saveLead(lead);
 res.json({ok:true,stored:true,leadId,message:"Lead saved in SQLite."});
});
app.post("/api/download-events",(req,res)=>{
 const v=validateDownloadEvent({...req.body,userAgent:ua(req),ipAddress:ip(req)}); if(!v.ok) return res.status(v.status).json({ok:false,message:v.message});
 const eventId=saveEvent(v.event);
 res.json({ok:true,stored:true,eventId,message:"Download event saved in SQLite."});
});
app.get("/api/leads",requireAdmin,(_req,res)=>{
 const rows=db.prepare(`SELECT id,name,email,industry,title,interest,whitepaper,download_file AS downloadFile,request_type AS requestType,created_at AS createdAt,user_agent AS userAgent,ip_address AS ipAddress,inserted_at AS insertedAt FROM leads ORDER BY id DESC LIMIT 1000`).all();
 res.json({ok:true,count:rows.length,leads:rows});
});
app.get("/api/download-events",requireAdmin,(_req,res)=>{
 const rows=db.prepare(`SELECT id,lead_id AS leadId,name,email,industry,title,interest,whitepaper,download_file AS downloadFile,event_type AS eventType,user_agent AS userAgent,ip_address AS ipAddress,created_at AS createdAt,inserted_at AS insertedAt FROM whitepaper_download_events ORDER BY id DESC LIMIT 1000`).all();
 res.json({ok:true,count:rows.length,events:rows});
});
app.get("/api/summary",requireAdmin,(_req,res)=>{
 const leadCount=db.prepare("SELECT COUNT(*) count FROM leads").get().count;
 const downloadCount=db.prepare("SELECT COUNT(*) count FROM whitepaper_download_events").get().count;
 const uniqueLeadEmails=db.prepare("SELECT COUNT(DISTINCT email) count FROM leads").get().count;
 const uniqueDownloadEmails=db.prepare("SELECT COUNT(DISTINCT email) count FROM whitepaper_download_events").get().count;
 const byWhitepaper=db.prepare("SELECT whitepaper,COUNT(*) downloads,COUNT(DISTINCT email) uniqueEmails FROM whitepaper_download_events GROUP BY whitepaper ORDER BY downloads DESC").all();
 res.json({ok:true,leadCount,downloadCount,uniqueLeadEmails,uniqueDownloadEmails,byWhitepaper});
});
app.get("/api/export/leads.csv",requireAdmin,(_req,res)=>{
 const rows=db.prepare("SELECT * FROM leads ORDER BY id DESC").all();
 res.setHeader("Content-Type","text/csv"); res.setHeader("Content-Disposition","attachment; filename=leads.csv");
 res.send(csv(rows,["id","name","email","industry","title","interest","whitepaper","download_file","request_type","created_at","user_agent","ip_address","inserted_at"]));
});
app.get("/api/export/download-events.csv",requireAdmin,(_req,res)=>{
 const rows=db.prepare("SELECT * FROM whitepaper_download_events ORDER BY id DESC").all();
 res.setHeader("Content-Type","text/csv"); res.setHeader("Content-Disposition","attachment; filename=download-events.csv");
 res.send(csv(rows,["id","lead_id","name","email","industry","title","interest","whitepaper","download_file","event_type","user_agent","ip_address","created_at","inserted_at"]));
});
app.get("*",(_req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

if(require.main===module){
 app.listen(PORT,"0.0.0.0",()=>console.log(`Truflux clean v1.4.0 running on port ${PORT}. Email removed; SQLite only.`));
}
module.exports={app,validateLead,validateDownloadEvent};
