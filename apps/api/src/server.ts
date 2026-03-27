import cors from "@fastify/cors";
import Fastify from "fastify";
import { closeDatabase } from "./db/database.js";
import { registerCalculationRoutes } from "./routes/calculations.js";
import { registerContextRoutes } from "./routes/context.js";
import { registerEmployeeRoutes } from "./routes/employees.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerImportRoutes } from "./routes/import.js";
import { registerMonthRecordRoutes } from "./routes/month-records.js";
import { registerTaxPolicyRoutes } from "./routes/tax-policy.js";
import { registerUnitRoutes } from "./routes/units.js";

const app = Fastify({ logger: false });
const serverHost = process.env.HOST ?? "127.0.0.1";
const serverPort = Number(process.env.PORT ?? "3001");
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
  methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

await registerHealthRoutes(app);
await registerImportRoutes(app);
await registerCalculationRoutes(app);
await registerContextRoutes(app);
await registerEmployeeRoutes(app);
await registerMonthRecordRoutes(app);
await registerTaxPolicyRoutes(app);
await registerUnitRoutes(app);

const start = async () => {
  try {
    await app.listen({
      host: serverHost,
      port: serverPort,
    });

    process.on("SIGINT", async () => {
      await app.close();
      closeDatabase();
      process.exit(0);
    });
  } catch (error) {
    app.log.error(error);
    closeDatabase();
    process.exit(1);
  }
};

void start();
