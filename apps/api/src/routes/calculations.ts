import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { calculationRunRepository } from "../repositories/calculation-run-repository.js";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";
import { calculateEmployeeAnnualTax, type EmployeeMonthRecord } from "@dude-tax/core";
import {
  annualTaxService,
  AnnualTaxResultNotFoundError,
  EmployeeCalculationNotReadyError,
} from "../services/annual-tax-service.js";
import { employeeRepository } from "../repositories/employee-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";
const withholdingContextSchema = z.object({
  mode: z
    .enum(["auto", "standard_cumulative", "annual_60000_upfront", "first_salary_month_cumulative"])
    .optional(),
  previousYearIncomeUnder60k: z.boolean().optional(),
  firstSalaryMonthInYear: z.number().int().min(1).max(12).nullable().optional(),
});
const recalculateSchema = z.object({
  employeeId: z.number().int().positive().optional(),
  withholdingContext: withholdingContextSchema.optional(),
});
const updateSelectedSchemeSchema = z.object({
  selectedScheme: z.enum(["separate_bonus", "combined_bonus"]),
});
const historyQuerySchema = z.object({
  unitId: z.coerce.number().int().positive().optional(),
  taxYear: z.coerce.number().int().min(2000).max(2100).optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  settlementDirection: z.enum(["payable", "refund", "balanced"]).optional(),
  resultStatus: z.enum(["current", "invalidated", "all"]).optional(),
});
const historyRecalculateSchema = z.object({
  unitId: z.number().int().positive(),
  taxYear: z.number().int().min(2000).max(2100),
  employeeId: z.number().int().positive(),
});
const quickCalculateRecordSchema = z.object({
  taxMonth: z.number().int().min(1).max(12),
  status: z.enum(["incomplete", "completed"]),
  salaryIncome: z.number().min(0),
  annualBonus: z.number().min(0),
  pensionInsurance: z.number().min(0),
  medicalInsurance: z.number().min(0),
  occupationalAnnuity: z.number().min(0),
  housingFund: z.number().min(0),
  supplementaryHousingFund: z.number().min(0),
  unemploymentInsurance: z.number().min(0),
  workInjuryInsurance: z.number().min(0),
  withheldTax: z.number().min(0),
  supplementarySalaryIncome: z.number().min(0).optional(),
  supplementaryWithheldTaxAdjustment: z.number().min(0).optional(),
  supplementarySourcePeriodLabel: z.string().trim().max(100).optional(),
  supplementaryRemark: z.string().trim().max(300).optional(),
  infantCareDeduction: z.number().min(0),
  childEducationDeduction: z.number().min(0),
  continuingEducationDeduction: z.number().min(0),
  housingLoanInterestDeduction: z.number().min(0),
  housingRentDeduction: z.number().min(0),
  elderCareDeduction: z.number().min(0),
  otherDeduction: z.number().min(0),
  taxReductionExemption: z.number().min(0),
  remark: z.string().optional(),
});
const quickCalculateSchema = z.object({
  unitId: z.number().int().positive(),
  taxYear: z.number().int().min(2000).max(2100),
  records: z.array(quickCalculateRecordSchema).min(1),
  withholdingContext: withholdingContextSchema.optional(),
});
const toTemporaryMonthRecord = (
  unitId: number,
  taxYear: number,
  record: z.infer<typeof quickCalculateRecordSchema>,
): EmployeeMonthRecord => ({
  id: null,
  unitId,
  employeeId: 0,
  taxYear,
  taxMonth: record.taxMonth,
  status: record.status,
  salaryIncome: record.salaryIncome,
  annualBonus: record.annualBonus,
  pensionInsurance: record.pensionInsurance,
  medicalInsurance: record.medicalInsurance,
  occupationalAnnuity: record.occupationalAnnuity,
  housingFund: record.housingFund,
  supplementaryHousingFund: record.supplementaryHousingFund,
  unemploymentInsurance: record.unemploymentInsurance,
  workInjuryInsurance: record.workInjuryInsurance,
  withheldTax: record.withheldTax,
  supplementarySalaryIncome: record.supplementarySalaryIncome,
  supplementaryWithheldTaxAdjustment: record.supplementaryWithheldTaxAdjustment,
  supplementarySourcePeriodLabel: record.supplementarySourcePeriodLabel,
  supplementaryRemark: record.supplementaryRemark,
  infantCareDeduction: record.infantCareDeduction,
  childEducationDeduction: record.childEducationDeduction,
  continuingEducationDeduction: record.continuingEducationDeduction,
  housingLoanInterestDeduction: record.housingLoanInterestDeduction,
  housingRentDeduction: record.housingRentDeduction,
  elderCareDeduction: record.elderCareDeduction,
  otherDeduction: record.otherDeduction,
  taxReductionExemption: record.taxReductionExemption,
  remark: record.remark ?? "",
  createdAt: null,
  updatedAt: null,
});
export const registerCalculationRoutes = async (app: FastifyInstance) => {
  app.post("/api/quick-calculate", async (request, reply) => {
    const parsedBody = quickCalculateSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply
        .status(400)
        .send({ message: "快速计算参数不合法", issues: parsedBody.error.flatten() });
    }
    const unitExists = unitRepository.list().some((unit) => unit.id === parsedBody.data.unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }
    const effectiveSettings = taxPolicyRepository.getEffectiveSettingsForScope(
      parsedBody.data.unitId,
      parsedBody.data.taxYear,
    );
    return calculateEmployeeAnnualTax(
      parsedBody.data.records.map((record) =>
        toTemporaryMonthRecord(parsedBody.data.unitId, parsedBody.data.taxYear, record),
      ),
      effectiveSettings,
      parsedBody.data.withholdingContext,
    );
  });
  app.get("/api/history-results", async (request, reply) => {
    const parsedQuery = historyQuerySchema.safeParse(request.query ?? {});
    if (!parsedQuery.success) {
      return reply
        .status(400)
        .send({ message: "历史查询参数不合法", issues: parsedQuery.error.flatten() });
    }
    if (parsedQuery.data.unitId) {
      const unitExists = unitRepository.list().some((unit) => unit.id === parsedQuery.data.unitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在" });
      }
    }
    if (parsedQuery.data.employeeId) {
      const employee = employeeRepository.getById(parsedQuery.data.employeeId);
      if (!employee) {
        return reply.status(404).send({ message: "目标员工不存在" });
      }
    }
    return annualTaxService.searchHistory(parsedQuery.data);
  });
  app.post("/api/history-results/recalculate", async (request, reply) => {
    const parsedBody = historyRecalculateSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply
        .status(400)
        .send({ message: "历史结果重算参数不合法", issues: parsedBody.error.flatten() });
    }
    const { unitId, taxYear, employeeId } = parsedBody.data;
    const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }
    const employee = employeeRepository.getById(employeeId);
    if (!employee || employee.unitId !== unitId) {
      return reply.status(404).send({ message: "目标员工不存在" });
    }
    try {
      return annualTaxService.recalculateHistoryResult(unitId, taxYear, employeeId);
    } catch (error) {
      if (error instanceof AnnualTaxResultNotFoundError) {
        return reply.status(404).send({ message: error.message });
      }
      throw error;
    }
  });
  app.get("/api/units/:unitId/years/:taxYear/calculation-statuses", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);
    const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }
    return calculationRunRepository.listStatuses(
      unitId,
      taxYear,
      taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear),
    );
  });
  app.get("/api/units/:unitId/years/:taxYear/annual-results", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);
    const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }
    return annualTaxService.listResults(unitId, taxYear);
  });
  app.get(
    "/api/units/:unitId/years/:taxYear/employees/:employeeId/annual-result-versions",
    async (request, reply) => {
      const params = request.params as { unitId: string; taxYear: string; employeeId: string };
      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const employeeId = Number(params.employeeId);
      const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在" });
      }
      const employee = employeeRepository.getById(employeeId);
      if (!employee || employee.unitId !== unitId) {
        return reply.status(404).send({ message: "目标员工不存在" });
      }
      return annualTaxService.listResultVersions(unitId, taxYear, employeeId);
    },
  );
  app.get(
    "/api/units/:unitId/years/:taxYear/annual-results/export-preview",
    async (request, reply) => {
      const unitId = Number((request.params as { unitId: string }).unitId);
      const taxYear = Number((request.params as { taxYear: string }).taxYear);
      const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在" });
      }
      return annualTaxService.listExportPreview(unitId, taxYear);
    },
  );
  app.put(
    "/api/units/:unitId/years/:taxYear/annual-results/:employeeId/selected-scheme",
    async (request, reply) => {
      const params = request.params as { unitId: string; taxYear: string; employeeId: string };
      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const employeeId = Number(params.employeeId);
      const parsedBody = updateSelectedSchemeSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ message: "方案切换参数不合法", issues: parsedBody.error.flatten() });
      }
      const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在" });
      }
      const employee = employeeRepository.getById(employeeId);
      if (!employee || employee.unitId !== unitId) {
        return reply.status(404).send({ message: "目标员工不存在" });
      }
      try {
        return annualTaxService.updateSelectedScheme(
          unitId,
          employeeId,
          taxYear,
          parsedBody.data.selectedScheme,
        );
      } catch (error) {
        if (error instanceof AnnualTaxResultNotFoundError) {
          return reply.status(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );
  app.post(
    "/api/units/:unitId/years/:taxYear/calculation-statuses/recalculate",
    async (request, reply) => {
      const unitId = Number((request.params as { unitId: string }).unitId);
      const taxYear = Number((request.params as { taxYear: string }).taxYear);
      const parsedBody = recalculateSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ message: "重算参数不合法", issues: parsedBody.error.flatten() });
      }
      const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在" });
      }
      if (parsedBody.data.employeeId) {
        const employee = employeeRepository.getById(parsedBody.data.employeeId);
        if (!employee || employee.unitId !== unitId) {
          return reply.status(404).send({ message: "目标员工不存在" });
        }
      }
      try {
        return annualTaxService.recalculate(
          unitId,
          taxYear,
          parsedBody.data.employeeId,
          parsedBody.data.withholdingContext,
        );
      } catch (error) {
        if (error instanceof EmployeeCalculationNotReadyError) {
          return reply.status(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );
};
