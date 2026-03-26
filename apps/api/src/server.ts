import cors from "@fastify/cors";
import Fastify from "fastify";
import { closeDatabase } from "./db/database.js";
import { registerCalculationRoutes } from "./routes/calculations.js";
import { registerContextRoutes } from "./routes/context.js";
import { registerEmployeeRoutes } from "./routes/employees.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMonthRecordRoutes } from "./routes/month-records.js";
import { registerTaxPolicyRoutes } from "./routes/tax-policy.js";
import { registerUnitRoutes } from "./routes/units.js";

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: true,
});

await registerHealthRoutes(app);
await registerCalculationRoutes(app);
await registerContextRoutes(app);
await registerEmployeeRoutes(app);
await registerMonthRecordRoutes(app);
await registerTaxPolicyRoutes(app);
await registerUnitRoutes(app);

const start = async () => {
  try {
    await app.listen({
      host: "127.0.0.1",
      port: 3001,
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
