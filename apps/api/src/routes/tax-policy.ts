import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";

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

const buildMonotonicValidator = <T>(
  brackets: T[],
  getMaxValue: (bracket: T) => number | null,
) => {
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
    basicDeductionAmount: z.number().min(0),
    comprehensiveTaxBrackets: z.array(comprehensiveBracketSchema).min(1),
    bonusTaxBrackets: z.array(bonusBracketSchema).min(1),
    maintenanceNotes: z.string().max(2000).optional(),
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
      !buildMonotonicValidator(
        value.comprehensiveTaxBrackets,
        (bracket) => bracket.maxAnnualIncome,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "综合所得税率表阈值必须递增，且最后一档必须为不封顶",
        path: ["comprehensiveTaxBrackets"],
      });
    }

    if (
      !buildMonotonicValidator(
        value.bonusTaxBrackets,
        (bracket) => bracket.maxAverageMonthlyIncome,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "年终奖税率表阈值必须递增，且最后一档必须为不封顶",
        path: ["bonusTaxBrackets"],
      });
    }
  });

export const registerTaxPolicyRoutes = async (app: FastifyInstance) => {
  app.get("/api/tax-policy", async () => taxPolicyRepository.get());

  app.put("/api/tax-policy", async (request, reply) => {
    const parsedBody = taxPolicySchema.safeParse(request.body ?? {});

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "税率参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    return taxPolicyRepository.save(parsedBody.data);
  });
};

