import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";

const MAX_POLICY_ILLUSTRATION_DATA_URL_LENGTH = 8_000_000;
const TAX_POLICY_ROUTE_BODY_LIMIT = 10 * 1024 * 1024;

const comprehensiveBracketSchema = z.object({
  level: z.number().int().positive(),
  maxAnnualIncome: z.number().int().positive().nullable(),
  rate: z.number().min(0).max(100),
  quickDeduction: z.number().min(0),
});

const bonusBracketSchema = z.object({
  level: z.number().int().positive(),
  maxAverageMonthlyIncome: z.number().int().positive().nullable(),
  rate: z.number().min(0).max(100),
  quickDeduction: z.number().min(0),
});

const policyItemSchema = z.object({
  id: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  body: z.string().max(2000).optional(),
  illustrationDataUrl: z.string().max(MAX_POLICY_ILLUSTRATION_DATA_URL_LENGTH).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const scopePayloadSchema = z.object({
  unitId: z.number().int().positive(),
  taxYear: z.number().int().min(1900),
});

const optionalScopePayloadSchema = z.object({
  unitId: z.number().int().positive().optional(),
  taxYear: z.number().int().min(1900).optional(),
});

const renameVersionSchema = optionalScopePayloadSchema.extend({
  versionName: z.string().trim().min(1).max(100),
});

const buildMonotonicValidator = <T>(brackets: T[], getMaxValue: (bracket: T) => number | null) => {
  let previousValue: number | null = null;

  for (let index = 0; index < brackets.length; index += 1) {
    const currentValue = getMaxValue(brackets[index]!);
    const isLast = index === brackets.length - 1;

    if (!isLast && currentValue === null) {
      return false;
    }

    if (isLast && currentValue !== null) {
      return false;
    }

    if (currentValue !== null && previousValue !== null && currentValue <= previousValue) {
      return false;
    }

    previousValue = currentValue;
  }

  return true;
};

const taxPolicySchema = z
  .object({
    unitId: z.number().int().positive().optional(),
    taxYear: z.number().int().min(1900).optional(),
    basicDeductionAmount: z.number().min(0),
    comprehensiveTaxBrackets: z.array(comprehensiveBracketSchema).min(1),
    bonusTaxBrackets: z.array(bonusBracketSchema).min(1),
    maintenanceNotes: z.string().max(2000).optional(),
    policyItems: z.array(policyItemSchema).max(20).optional(),
    versionName: z.string().max(100).optional(),
    policyTitle: z.string().max(100).optional(),
    policyBody: z.string().max(2000).optional(),
    policyIllustrationDataUrl: z.string().max(MAX_POLICY_ILLUSTRATION_DATA_URL_LENGTH).optional(),
  })
  .superRefine((value, context) => {
    const comprehensiveLevels = value.comprehensiveTaxBrackets.map((bracket) => bracket.level);
    const bonusLevels = value.bonusTaxBrackets.map((bracket) => bracket.level);

    if (
      new Set(comprehensiveLevels).size !== comprehensiveLevels.length ||
      !comprehensiveLevels.every((level, index) => level === index + 1)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "综合所得税率表级数必须从 1 开始连续递增",
        path: ["comprehensiveTaxBrackets"],
      });
    }

    if (
      new Set(bonusLevels).size !== bonusLevels.length ||
      !bonusLevels.every((level, index) => level === index + 1)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "年终奖税率表级数必须从 1 开始连续递增",
        path: ["bonusTaxBrackets"],
      });
    }

    if (
      !buildMonotonicValidator(value.comprehensiveTaxBrackets, (bracket) => bracket.maxAnnualIncome)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "综合所得税率表阈值必须递增，且最后一档必须为不封顶",
        path: ["comprehensiveTaxBrackets"],
      });
    }

    if (
      !buildMonotonicValidator(value.bonusTaxBrackets, (bracket) => bracket.maxAverageMonthlyIncome)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "年终奖税率表阈值必须递增，且最后一档必须为不封顶",
        path: ["bonusTaxBrackets"],
      });
    }
  });

export const registerTaxPolicyRoutes = async (app: FastifyInstance) => {
  app.get("/api/tax-policy", async (request) => {
    const query = request.query as { unitId?: string; taxYear?: string };
    const unitId = query.unitId ? Number(query.unitId) : undefined;
    const taxYear = query.taxYear ? Number(query.taxYear) : undefined;

    return taxPolicyRepository.get(unitId, taxYear);
  });

  app.post("/api/tax-policy/versions/:versionId/activate", async (request, reply) => {
    const versionId = Number((request.params as { versionId: string }).versionId);

    if (!Number.isInteger(versionId) || versionId <= 0) {
      return reply.status(400).send({ message: "税率版本参数不合法" });
    }

    const response = taxPolicyRepository.activateVersion(versionId);
    if (!response) {
      return reply.status(404).send({ message: "目标税率版本不存在" });
    }

    return response;
  });

  app.patch("/api/tax-policy/versions/:versionId", async (request, reply) => {
    const versionId = Number((request.params as { versionId: string }).versionId);
    const parsedBody = renameVersionSchema.safeParse(request.body ?? {});

    if (!Number.isInteger(versionId) || versionId <= 0) {
      return reply.status(400).send({ message: "税率版本参数不合法" });
    }

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "版本名称参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const response = taxPolicyRepository.renameVersion(
      versionId,
      parsedBody.data.versionName,
      parsedBody.data.unitId,
      parsedBody.data.taxYear,
    );

    if (!response) {
      return reply.status(404).send({ message: "目标税率版本不存在" });
    }

    return response;
  });

  app.get("/api/tax-policy/versions/:versionId/impact-preview", async (request, reply) => {
    const versionId = Number((request.params as { versionId: string }).versionId);
    const query = request.query as { unitId?: string; taxYear?: string };
    const unitId = Number(query.unitId);
    const taxYear = Number(query.taxYear);

    if (!Number.isInteger(versionId) || versionId <= 0) {
      return reply.status(400).send({ message: "税率版本参数不合法" });
    }

    if (!Number.isInteger(unitId) || unitId <= 0 || !Number.isInteger(taxYear) || taxYear < 1900) {
      return reply.status(400).send({ message: "预览作用域参数不合法" });
    }

    const preview = taxPolicyRepository.previewVersionImpact(versionId, unitId, taxYear);
    if (!preview) {
      return reply.status(404).send({ message: "目标税率版本不存在" });
    }

    return preview;
  });

  app.post("/api/tax-policy/versions/:versionId/bind-scope", async (request, reply) => {
    const versionId = Number((request.params as { versionId: string }).versionId);
    const parsedBody = scopePayloadSchema.safeParse(request.body ?? {});

    if (!Number.isInteger(versionId) || versionId <= 0) {
      return reply.status(400).send({ message: "税率版本参数不合法" });
    }

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "税率作用域参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const response = taxPolicyRepository.bindVersionToScope({
      versionId,
      unitId: parsedBody.data.unitId,
      taxYear: parsedBody.data.taxYear,
    });
    if (!response) {
      return reply.status(404).send({ message: "目标税率版本不存在" });
    }

    return response;
  });

  app.post("/api/tax-policy/scopes/current/unbind", async (request, reply) => {
    const parsedBody = scopePayloadSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "税率作用域参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    return taxPolicyRepository.clearScopeBinding(parsedBody.data.unitId, parsedBody.data.taxYear);
  });

  app.route({
    method: "PUT",
    url: "/api/tax-policy",
    bodyLimit: TAX_POLICY_ROUTE_BODY_LIMIT,
    handler: async (request, reply) => {
      const parsedBody = taxPolicySchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send({
          message: "税率参数不合法",
          issues: parsedBody.error.flatten(),
        });
      }

      return taxPolicyRepository.save(parsedBody.data);
    },
  });
};
