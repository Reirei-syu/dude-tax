import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerContextRoutes } from "./routes/context.js";

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: true,
  methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
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
