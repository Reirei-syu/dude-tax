import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { calculationRunRepository } from "../repositories/calculation-run-repository.js";
import {
  annualTaxService,
  AnnualTaxResultNotFoundError,
  EmployeeCalculationNotReadyError,
} from "../services/annual-tax-service.js";
import { employeeRepository } from "../repositories/employee-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";

const recalculateSchema = z.object({
  employeeId: z.number().int().positive().optional(),
});

const updateSelectedSchemeSchema = z.object({
  selectedScheme: z.enum(["separate_bonus", "combined_bonus"]),
});

export const registerCalculationRoutes = async (app: FastifyInstance) => {
  app.get("/api/units/:unitId/years/:taxYear/calculation-statuses", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);

    const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    return calculationRunRepository.listStatuses(unitId, taxYear);
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

  app.get("/api/units/:unitId/years/:taxYear/annual-results/export-preview", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const taxYear = Number((request.params as { taxYear: string }).taxYear);

    const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    return annualTaxService.listExportPreview(unitId, taxYear);
  });

  app.put(
    "/api/units/:unitId/years/:taxYear/annual-results/:employeeId/selected-scheme",
    async (request, reply) => {
      const params = request.params as { unitId: string; taxYear: string; employeeId: string };
      const unitId = Number(params.unitId);
      const taxYear = Number(params.taxYear);
      const employeeId = Number(params.employeeId);
      const parsedBody = updateSelectedSchemeSchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send({
          message: "方案切换参数不合法",
          issues: parsedBody.error.flatten(),
        });
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
        return reply.status(400).send({
          message: "重算参数不合法",
          issues: parsedBody.error.flatten(),
        });
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
        return annualTaxService.recalculate(unitId, taxYear, parsedBody.data.employeeId);
      } catch (error) {
        if (error instanceof EmployeeCalculationNotReadyError) {
          return reply.status(409).send({ message: error.message });
        }

        throw error;
      }
    },
  );
};
