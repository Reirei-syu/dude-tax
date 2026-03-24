import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { contextRepository } from "../repositories/context-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";

const updateContextSchema = z.object({
  currentUnitId: z.number().int().positive().nullable().optional(),
  currentTaxYear: z.number().int().min(2000).max(2100).optional(),
});

export const registerContextRoutes = async (app: FastifyInstance) => {
  app.get("/api/context", async () => contextRepository.get());

  app.put("/api/context", async (request, reply) => {
    const parsedBody = updateContextSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "上下文参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const { currentUnitId, currentTaxYear } = parsedBody.data;

    if (typeof currentUnitId !== "undefined" && currentUnitId !== null) {
      const unitExists = unitRepository.list().some((unit) => unit.id === currentUnitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在" });
      }
    }

    if (typeof currentUnitId !== "undefined") {
      contextRepository.setCurrentUnitId(currentUnitId ?? null);
    }

    if (typeof currentTaxYear !== "undefined") {
      contextRepository.setCurrentTaxYear(currentTaxYear);
    }

    return contextRepository.get();
  });
};

