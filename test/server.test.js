const test=require("node:test");const assert=require("node:assert/strict");const request=require("supertest");const {app,validateLead,validateDownloadEvent}=require("../server");
const lead={name:"Test",email:"test@example.com",industry:"Technology / SaaS",title:"CIO",interest:"AI",whitepaper:"Model Routing",downloadFile:"/whitepapers/model-routing.pdf",requestType:"Whitepaper Download",createdAt:"2026-05-22T00:00:00.000Z"};
test("health",async()=>{let r=await request(app).get("/api/health");assert.equal(r.status,200);assert.equal(r.body.version,"1.4.0");assert.equal(r.body.emailIntegration,false)});
test("lead validation",()=>assert.equal(validateLead(lead).ok,true));
test("bad email rejected",()=>assert.equal(validateLead({...lead,email:"bad"}).ok,false));
test("event validation",()=>assert.equal(validateDownloadEvent(lead).ok,true));
test("store lead",async()=>{let r=await request(app).post("/api/leads").send(lead);assert.equal(r.body.ok,true)});
test("admin requires key",async()=>{let r=await request(app).get("/api/summary");assert.equal(r.status,401)});
test("admin with key",async()=>{let r=await request(app).get("/api/summary").set("x-admin-key","test123");assert.equal(r.status,200)});
