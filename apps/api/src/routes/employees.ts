import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { employeeRepository } from "../repositories/employee-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";

const employeePayloadSchema = z.object({
  employeeCode: z.string().trim().min(1, "工号不能为空").max(50, "工号不能超过 50 个字符"),
  employeeName: z.string().trim().min(1, "姓名不能为空").max(100, "姓名不能超过 100 个字符"),
  idNumber: z.string().trim().min(1, "证件号不能为空").max(50, "证件号不能超过 50 个字符"),
  hireDate: z.string().trim().optional().nullable(),
  leaveDate: z.string().trim().optional().nullable(),
  remark: z.string().trim().max(300, "备注不能超过 300 个字符").optional(),
});

export const registerEmployeeRoutes = async (app: FastifyInstance) => {
  app.get("/api/units/:unitId/employees", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const unitExists = unitRepository.list().some((unit) => unit.id === unitId);

    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    return employeeRepository.listByUnitId(unitId);
  });

  app.post("/api/units/:unitId/employees", async (request, reply) => {
    const unitId = Number((request.params as { unitId: string }).unitId);
    const parsedBody = employeePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "员工参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const unitExists = unitRepository.list().some((unit) => unit.id === unitId);
    if (!unitExists) {
      return reply.status(404).send({ message: "目标单位不存在" });
    }

    const duplicated = employeeRepository.listByUnitId(unitId).some((employee) => {
      return (
        employee.employeeCode === parsedBody.data.employeeCode ||
        employee.idNumber === parsedBody.data.idNumber
      );
    });

    if (duplicated) {
      return reply.status(409).send({ message: "工号或证件号已存在" });
    }

    const employee = employeeRepository.create(unitId, parsedBody.data);
    return reply.status(201).send(employee);
  });

  app.put("/api/employees/:employeeId", async (request, reply) => {
    const employeeId = Number((request.params as { employeeId: string }).employeeId);
    const parsedBody = employeePayloadSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "员工参数不合法",
        issues: parsedBody.error.flatten(),
      });
    }

    const currentEmployee = employeeRepository.getById(employeeId);
    if (!currentEmployee) {
      return reply.status(404).send({ message: "目标员工不存在" });
    }

    const duplicated = employeeRepository.listByUnitId(currentEmployee.unitId).some((employee) => {
      if (employee.id === employeeId) {
        return false;
      }

      return (
        employee.employeeCode === parsedBody.data.employeeCode ||
        employee.idNumber === parsedBody.data.idNumber
      );
    });

    if (duplicated) {
      return reply.status(409).send({ message: "工号或证件号已存在" });
    }

    return employeeRepository.update(employeeId, parsedBody.data);
  });

  app.delete("/api/employees/:employeeId", async (request, reply) => {
    const employeeId = Number((request.params as { employeeId: string }).employeeId);
    const currentEmployee = employeeRepository.getById(employeeId);

    if (!currentEmployee) {
      return reply.status(404).send({ message: "目标员工不存在" });
    }

    employeeRepository.deleteById(employeeId);
    return { success: true };
  });
};
