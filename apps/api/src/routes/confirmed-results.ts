import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { employeeRepository } from "../repositories/employee-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";
import { confirmedResultsService } from "../services/confirmed-results-service.js";

const confirmedResultsQuerySchema = z.object({
  throughMonth: z.coerce.number().int().min(1).max(12).optional(),
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

export const registerConfirmedResultRoutes = async (app: FastifyInstance) => {
  app.get("/api/units/:unitId/years/:taxYear/confirmed-results", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);
    const unitAndYear = ensureUnitAndYear(unitId, taxYear);
    if (!unitAndYear.ok) {
      return reply.status(unitAndYear.statusCode).send({ message: unitAndYear.message });
    }

    const parsedQuery = confirmedResultsQuerySchema.safeParse(request.query ?? {});
    if (!parsedQuery.success) {
      return reply.status(400).send({
        message: "结果确认查询参数不合法。",
        issues: parsedQuery.error.flatten(),
      });
    }

    return confirmedResultsService.listResults(unitId, taxYear, parsedQuery.data.throughMonth);
  });

  app.get(
    "/api/units/:unitId/years/:taxYear/confirmed-results/:employeeId",
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

      const parsedQuery = confirmedResultsQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        return reply.status(400).send({
          message: "结果确认明细参数不合法。",
          issues: parsedQuery.error.flatten(),
        });
      }

      const detail = confirmedResultsService.getResultDetail(
        unitId,
        taxYear,
        employeeId,
        parsedQuery.data.throughMonth,
      );

      if (!detail) {
        return reply.status(404).send({ message: "目标员工当前没有已确认结果。" });
      }

      return detail;
    },
  );
};
