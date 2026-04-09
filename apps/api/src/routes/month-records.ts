import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { employeeRepository } from "../repositories/employee-repository.js";
import { monthConfirmationRepository } from "../repositories/month-confirmation-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";

const monthRecordPayloadSchema = z.object({
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

const toCanonicalPayload = (payload: z.infer<typeof monthRecordPayloadSchema>) => ({
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

export const registerMonthRecordRoutes = async (app: FastifyInstance) => {
  app.get(
    "/api/units/:unitId/years/:taxYear/employees/:employeeId/month-records",
    async (request, reply) => {
      const unitId = Number((request.params as { unitId: string }).unitId);
      const taxYear = Number((request.params as { taxYear: string }).taxYear);
      const employeeId = Number((request.params as { employeeId: string }).employeeId);

      const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在。" });
      }

      const employee = employeeRepository.getById(employeeId);
      if (!employee || employee.unitId !== unitId) {
        return reply.status(404).send({ message: "目标员工不存在。" });
      }

      return monthRecordRepository.listByEmployeeAndYear(unitId, employeeId, taxYear);
    },
  );

  app.put(
    "/api/units/:unitId/years/:taxYear/employees/:employeeId/month-records/:taxMonth",
    async (request, reply) => {
      const params = request.params as {
        unitId: string;
        taxYear: string;
        employeeId: string;
        taxMonth: string;
      };

      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const employeeId = Number(params.employeeId);
      const taxMonth = Number(params.taxMonth);

      const parsedBody = monthRecordPayloadSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply.status(400).send({
          message: "月度记录参数不合法。",
          issues: parsedBody.error.flatten(),
        });
      }

      if (taxMonth < 1 || taxMonth > 12) {
        return reply.status(400).send({ message: "月份必须在 1 到 12 之间。" });
      }

      const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
      if (!unitExists) {
        return reply.status(404).send({ message: "目标单位不存在。" });
      }

      const employee = employeeRepository.getById(employeeId);
      if (!employee || employee.unitId !== unitId) {
        return reply.status(404).send({ message: "目标员工不存在。" });
      }

      if (monthConfirmationRepository.isConfirmed(unitId, taxYear, taxMonth)) {
        return reply.status(409).send({
          message: "目标月份已确认，禁止修改。",
          lockedMonths: [taxMonth],
        });
      }

      return monthRecordRepository.upsert(
        unitId,
        employeeId,
        taxYear,
        taxMonth,
        toCanonicalPayload(parsedBody.data),
      );
    },
  );
};
