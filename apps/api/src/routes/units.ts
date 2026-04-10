import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { contextRepository } from "../repositories/context-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";
import { UnitBackupError, unitBackupService } from "../services/unit-backup-service.js";

const taxYearSchema = z.number().int().min(1900, "年份必须大于等于 1900");

const createUnitSchema = z.object({
  unitName: z.string().trim().min(1, "单位名称不能为空").max(100, "单位名称不能超过 100 个字符"),
  remark: z.string().trim().max(300, "备注不能超过 300 个字符").optional(),
  startYear: taxYearSchema,
});

const addYearSchema = z.object({
  taxYear: taxYearSchema,
});

const deleteChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  confirmationCode: z.string().length(6, "认证字符长度应为 6"),
  acknowledgeIrreversible: z.literal(true),
});

const createUnitBackupSchema = z.object({
  targetPath: z.string().trim().min(1, "备份文件路径不能为空").max(500, "备份文件路径过长"),
});

const deleteChallenges = new Map<string, { unitId: number; code: string; expiresAt: number }>();

const challengeCharacters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*?";

const generateChallengeCode = () =>
  Array.from({ length: 6 })
    .map(() => challengeCharacters[crypto.randomInt(0, challengeCharacters.length)])
    .join("");

export const registerUnitRoutes = async (app: FastifyInstance) => {
  app.get("/api/units", async () => unitRepository.list());

  app.get("/api/units/:unitId/backup-draft", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const draft = unitBackupService.getDraft(unitId);

    if (!draft) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    return draft;
  });

  app.post("/api/units", async (request, reply) => {
    const parsedBody = createUnitSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "单位参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const duplicated = unitRepository
      .list()
      .some((unit) => unit.unitName === parsedBody.data.unitName);

    if (duplicated) {
      return reply.status(409).send({ message: "单位名称已存在" });
    }

    const createdUnit = unitRepository.create(parsedBody.data);
    if (!contextRepository.get().currentUnitId) {
      contextRepository.setCurrentUnitId(createdUnit.id);
    }

    return reply.status(201).send(createdUnit);
  });

  app.post("/api/units/:unitId/years", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const parsedBody = addYearSchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "年份参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const unit = unitRepository.getById(unitId);
    if (!unit) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    if (unit.availableTaxYears.includes(parsedBody.data.taxYear)) {
      return reply.status(409).send({ message: "该年份已存在" });
    }

    return unitRepository.addYear(unitId, parsedBody.data.taxYear);
  });

  app.delete("/api/units/:unitId/years/:taxYear", async (request, reply) => {
    const params = request.params as { unitId: string; taxYear: string };
    const unitId = Number(params.unitId);
    const taxYear = Number(params.taxYear);

    if (!Number.isInteger(taxYear) || taxYear < 1900) {
      return reply.status(400).send({ message: "年份参数不合法" });
    }

    const unit = unitRepository.getById(unitId);
    if (!unit) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    const deletionCheck = unitRepository.canDeleteYear(unitId, taxYear);
    if (!deletionCheck.canDelete) {
      return reply.status(409).send({ message: deletionCheck.reason });
    }

    const nextUnit = unitRepository.deleteYear(unitId, taxYear);
    if (contextRepository.get().currentUnitId === unitId) {
      contextRepository.setCurrentUnitId(unitId);
    }

    return nextUnit;
  });

  app.post("/api/units/:unitId/delete-challenge", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const unit = unitRepository.getById(unitId);

    if (!unit) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    const challengeId = crypto.randomUUID();
    const code = generateChallengeCode();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    deleteChallenges.set(challengeId, { unitId, code, expiresAt });

    return {
      challengeId,
      confirmationCode: code,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  });

  app.post("/api/units/:unitId/backup", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const parsedBody = createUnitBackupSchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "备份参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    try {
      return await unitBackupService.createBackup(unitId, parsedBody.data);
    } catch (error) {
      if (error instanceof UnitBackupError) {
        return reply.status(error.statusCode).send({
          message: error.message,
        });
      }

      return reply.status(500).send({
        message: error instanceof Error ? error.message : "生成单位备份失败",
      });
    }
  });

  app.delete("/api/units/:unitId", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const parsedBody = deleteChallengeSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "删除认证参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const challenge = deleteChallenges.get(parsedBody.data.challengeId);
    if (!challenge || challenge.unitId !== unitId) {
      return reply.status(400).send({ message: "删除认证已失效，请重新生成认证字符" });
    }

    if (challenge.expiresAt < Date.now()) {
      deleteChallenges.delete(parsedBody.data.challengeId);
      return reply.status(400).send({ message: "删除认证已过期，请重新生成认证字符" });
    }

    if (challenge.code !== parsedBody.data.confirmationCode) {
      return reply.status(400).send({ message: "认证字符不匹配" });
    }

    unitRepository.deleteById(unitId);
    deleteChallenges.delete(parsedBody.data.challengeId);

    const nextUnits = unitRepository.list();
    if (contextRepository.get().currentUnitId === unitId) {
      contextRepository.setCurrentUnitId(nextUnits[0]?.id ?? null);
    }

    return { success: true };
  });
};
