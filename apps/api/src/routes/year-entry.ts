import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { employeeRepository } from "../repositories/employee-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";
import {
  EmploymentIncomeConflictError,
  MonthConfirmationConflictError,
  yearEntryService,
} from "../services/year-entry-service.js";

const yearRecordItemSchema = z.object({
  taxMonth: z.number().int().min(1).max(12),
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
  otherIncome: z.number().min(0).optional(),
  otherIncomeRemark: z.string().trim().max(300).optional(),
  infantCareDeduction: z.number().min(0),
  childEducationDeduction: z.number().min(0),
  continuingEducationDeduction: z.number().min(0),
  housingLoanInterestDeduction: z.number().min(0),
  housingRentDeduction: z.number().min(0),
  elderCareDeduction: z.number().min(0),
  otherDeduction: z.number().min(0),
  taxReductionExemption: z.number().min(0),
  remark: z.string().trim().max(300).optional(),
  status: z.enum(["incomplete", "completed"]).optional(),
  supplementarySalaryIncome: z.number().min(0).optional(),
  supplementaryWithheldTaxAdjustment: z.number().optional(),
  supplementarySourcePeriodLabel: z.string().trim().max(100).optional(),
  supplementaryRemark: z.string().trim().max(300).optional(),
});

const batchUpsertSchema = z.object({
  months: z.array(yearRecordItemSchema),
  acknowledgedEmploymentConflictMonths: z
    .array(z.number().int().min(1).max(12))
    .optional(),
});

const yearEntryCalculateSchema = z.object({
  employeeIds: z.array(z.number().int().positive()),
  withholdingContext: z
    .object({
      mode: z
        .enum(["auto", "standard_cumulative", "annual_60000_upfront", "first_salary_month_cumulative"])
        .optional(),
      previousYearIncomeUnder60k: z.boolean().optional(),
      firstSalaryMonthInYear: z.number().int().min(1).max(12).nullable().optional(),
    })
    .optional(),
});

const toCanonicalPayload = (payload: z.infer<typeof yearRecordItemSchema>) => ({
  taxMonth: payload.taxMonth,
  salaryIncome: payload.salaryIncome,
  annualBonus: payload.annualBonus,
  pensionInsurance: payload.pensionInsurance,
  medicalInsurance: payload.medicalInsurance,
  occupationalAnnuity: payload.occupationalAnnuity,
  housingFund: payload.housingFund,
  supplementaryHousingFund: payload.supplementaryHousingFund,
  unemploymentInsurance: payload.unemploymentInsurance,
  workInjuryInsurance: payload.workInjuryInsurance,
  withheldTax: payload.withheldTax,
  otherIncome: payload.otherIncome ?? payload.supplementarySalaryIncome ?? 0,
  otherIncomeRemark: payload.otherIncomeRemark ?? payload.supplementaryRemark ?? "",
  infantCareDeduction: payload.infantCareDeduction,
  childEducationDeduction: payload.childEducationDeduction,
  continuingEducationDeduction: payload.continuingEducationDeduction,
  housingLoanInterestDeduction: payload.housingLoanInterestDeduction,
  housingRentDeduction: payload.housingRentDeduction,
  elderCareDeduction: payload.elderCareDeduction,
  otherDeduction: payload.otherDeduction,
  taxReductionExemption: payload.taxReductionExemption,
  remark: payload.remark ?? "",
});

const ensureUnitAndYear = (unitId: number, taxYear: number) => {
  const unit = unitRepository.getById(unitId);
  if (!unit) {
    return {
      ok: false as const,
      statusCode: 404,
      message: "目标单位不存在。",
    };
  }

  if (!unit.availableTaxYears.includes(taxYear)) {
    return {
      ok: false as const,
      statusCode: 404,
      message: "目标年度不存在。",
    };
  }

  return {
    ok: true as const,
    unit,
  };
};

export const registerYearEntryRoutes = async (app: FastifyInstance) => {
  app.get("/api/units/:unitId/years/:taxYear/year-entry-overview", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);
    const unitAndYear = ensureUnitAndYear(unitId, taxYear);
    if (!unitAndYear.ok) {
      return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
    }

    return yearEntryService.buildYearEntryOverview(unitId, taxYear);
  });

  app.post("/api/units/:unitId/years/:taxYear/year-entry-calculate", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);
    const unitAndYear = ensureUnitAndYear(unitId, taxYear);
    if (!unitAndYear.ok) {
      return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
    }

    const parsedBody = yearEntryCalculateSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "年度录入计算参数不合法。",
        issues: parsedBody.error.flatten(),
      });
    }

    return yearEntryService.calculateYearEntryResults(
      unitId,
      taxYear,
      parsedBody.data.employeeIds,
      parsedBody.data.withholdingContext,
    );
  });

  app.get(
    "/api/units/:unitId/years/:taxYear/employees/:employeeId/year-record-workspace",
    async (request, reply) => {
      const params = request.params as {
        unitId: string;
        taxYear: string;
        employeeId: string;
      };
      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const employeeId = Number(params.employeeId);
      const unitAndYear = ensureUnitAndYear(unitId, taxYear);
      if (!unitAndYear.ok) {
        return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
      }

      const employee = employeeRepository.getById(employeeId);
      if (!employee || employee.unitId !== unitId) {
        return reply.status(404).send({ message: "目标员工不存在。" });
      }

      return yearEntryService.buildEmployeeYearWorkspace(unitId, taxYear, employeeId);
    },
  );

  app.put(
    "/api/units/:unitId/years/:taxYear/employees/:employeeId/year-record-workspace",
    async (request, reply) => {
      const params = request.params as {
        unitId: string;
        taxYear: string;
        employeeId: string;
      };
      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const employeeId = Number(params.employeeId);
      const unitAndYear = ensureUnitAndYear(unitId, taxYear);
      if (!unitAndYear.ok) {
        return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
      }

      const employee = employeeRepository.getById(employeeId);
      if (!employee || employee.unitId !== unitId) {
        return reply.status(404).send({ message: "目标员工不存在。" });
      }

      const parsedBody = batchUpsertSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply.status(400).send({
          message: "年度录入保存参数不合法。",
          issues: parsedBody.error.flatten(),
        });
      }

      try {
        return yearEntryService.saveEmployeeYearWorkspace(unitId, taxYear, employeeId, {
          months: parsedBody.data.months.map(toCanonicalPayload),
          acknowledgedEmploymentConflictMonths:
            parsedBody.data.acknowledgedEmploymentConflictMonths,
        });
      } catch (error) {
        if (error instanceof MonthConfirmationConflictError) {
          return reply.status(409).send({
            message: error.message,
            lockedMonths: error.lockedMonths,
          });
        }
        if (error instanceof EmploymentIncomeConflictError) {
          return reply.status(409).send(error.conflictResponse);
        }

        throw error;
      }
    },
  );

  app.get("/api/units/:unitId/years/:taxYear/month-confirmations", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);
    const unitAndYear = ensureUnitAndYear(unitId, taxYear);
    if (!unitAndYear.ok) {
      return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
    }

    return yearEntryService.getMonthConfirmationState(unitId, taxYear);
  });

  app.post(
    "/api/units/:unitId/years/:taxYear/month-confirmations/:taxMonth/confirm",
    async (request, reply) => {
      const params = request.params as {
        unitId: string;
        taxYear: string;
        taxMonth: string;
      };
      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const taxMonth = Number(params.taxMonth);
      const unitAndYear = ensureUnitAndYear(unitId, taxYear);
      if (!unitAndYear.ok) {
        return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
      }

      try {
        return yearEntryService.confirmMonth(unitId, taxYear, taxMonth);
      } catch (error) {
        if (error instanceof MonthConfirmationConflictError) {
          return reply.status(409).send({
            message: error.message,
            lockedMonths: error.lockedMonths,
          });
        }

        throw error;
      }
    },
  );

  app.post(
    "/api/units/:unitId/years/:taxYear/month-confirmations/:taxMonth/unconfirm",
    async (request, reply) => {
      const params = request.params as {
        unitId: string;
        taxYear: string;
        taxMonth: string;
      };
      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const taxMonth = Number(params.taxMonth);
      const unitAndYear = ensureUnitAndYear(unitId, taxYear);
      if (!unitAndYear.ok) {
        return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
      }

      return yearEntryService.unconfirmMonth(unitId, taxYear, taxMonth);
    },
  );
};
