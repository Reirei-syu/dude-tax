import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { importService } from "../services/import-service.js";
import { unitRepository } from "../repositories/unit-repository.js";

const importTypeSchema = z.enum(["employee", "month_record"]);
const importPreviewSchema = z.object({
  importType: importTypeSchema,
  unitId: z.number().int().positive(),
  csvText: z.string().min(1),
});
const importCommitSchema = importPreviewSchema.extend({
  conflictStrategy: z.enum(["skip", "overwrite", "abort"]),
});

export const registerImportRoutes = async (app: FastifyInstance) => {
  app.get("/api/import/templates/:importType", async (request, reply) => {
    const importType = importTypeSchema.safeParse(
      (request.params as { importType: string }).importType,
    );

    if (!importType.success) {
      return reply.status(400).send({ message: "导入类型不合法" });
    }

    reply.header("Content-Type", "text/csv; charset=utf-8");
    return importService.getTemplate(importType.data);
  });

  app.post("/api/import/preview", async (request, reply) => {
    const parsedBody = importPreviewSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "导入预览参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const unitExists = unitRepository.list().some((unit) => unit.id === parsedBody.data.unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    return importService.preview(
      parsedBody.data.importType,
      parsedBody.data.unitId,
      parsedBody.data.csvText,
    );
  });

  app.post("/api/import/commit", async (request, reply) => {
    const parsedBody = importCommitSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "执行导入参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const unitExists = unitRepository.list().some((unit) => unit.id === parsedBody.data.unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    return importService.commit(
      parsedBody.data.importType,
      parsedBody.data.unitId,
      parsedBody.data.csvText,
      parsedBody.data.conflictStrategy,
    );
  });
};
