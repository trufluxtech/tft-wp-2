const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { app, validateLead } = require("../server");

const validLead = {
  name: "Test User",
  email: "test@example.com",
  industry: "Technology / SaaS",
  title: "CIO",
  interest: "Enterprise AI Strategy",
  whitepaper: "Model Routing",
  downloadFile: "/whitepapers/model-routing.pdf",
  requestType: "Whitepaper Download",
  createdAt: "2026-05-22T00:00:00.000Z"
};

test("valid lead passes validation", () => {
  const result = validateLead(validLead);
  assert.equal(result.ok, true);
});

test("invalid email fails validation", () => {
  const result = validateLead({ ...validLead, email: "bad-email" });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("missing name fails validation", () => {
  const result = validateLead({ ...validLead, name: "" });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("health endpoint returns ok", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

test("lead endpoint accepts valid lead", async () => {
  const response = await request(app).post("/api/leads").send(validLead);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.leadId);
});

test("lead endpoint rejects invalid email", async () => {
  const response = await request(app).post("/api/leads").send({
    ...validLead,
    email: "wrong"
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
});
