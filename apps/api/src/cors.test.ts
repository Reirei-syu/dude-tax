import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerContextRoutes } from "./routes/context.js";

const app = Fastify({ logger: false });
const allowedOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const isAllowedOrigin = (origin?: string) =>
  !origin || origin === "null" || allowedOrigins.has(origin);

app.addHook("onRequest", async (request, reply) => {
  const origin = request.headers.origin;
  if (isAllowedOrigin(origin)) {
    return;
  }

  return reply.status(403).send({
    message: "禁止外部来源访问本地 API",
  });
});

await app.register(cors, {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

await registerContextRoutes(app);

after(async () => {
  await app.close();
});

test("CORS preflight allows PUT requests for local browser workflow", async () => {
  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/context",
    headers: {
      origin: "http://127.0.0.1:5173",
      "access-control-request-method": "PUT",
      "access-control-request-headers": "content-type",
    },
  });

  assert.equal(response.statusCode, 204);
  assert.match(String(response.headers["access-control-allow-methods"] ?? ""), /PUT/);
  assert.match(String(response.headers["access-control-allow-origin"] ?? ""), /127\.0\.0\.1:5173/);
});

test("CORS preflight allows PATCH requests for tax policy rename workflow", async () => {
  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/tax-policy/versions/1",
    headers: {
      origin: "http://127.0.0.1:5173",
      "access-control-request-method": "PATCH",
      "access-control-request-headers": "content-type",
    },
  });

  assert.equal(response.statusCode, 204);
  assert.match(String(response.headers["access-control-allow-methods"] ?? ""), /PATCH/);
  assert.match(String(response.headers["access-control-allow-origin"] ?? ""), /127\.0\.0\.1:5173/);
});

test("CORS preflight does not trust arbitrary external origins", async () => {
  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/context",
    headers: {
      origin: "https://evil.example",
      "access-control-request-method": "PUT",
      "access-control-request-headers": "content-type",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body, /禁止外部来源访问本地 API/);
});
