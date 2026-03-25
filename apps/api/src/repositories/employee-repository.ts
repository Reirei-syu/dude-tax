import type { CreateEmployeePayload, Employee, UpdateEmployeePayload } from "@salary-tax/core";
import { database } from "../db/database.js";

const mapRowToEmployee = (row: Record<string, unknown>): Employee => ({
  id: Number(row.id),
  unitId: Number(row.unit_id),
  employeeCode: String(row.employee_code),
  employeeName: String(row.employee_name),
  idNumber: String(row.id_number),
  hireDate: row.hire_date ? String(row.hire_date) : null,
  leaveDate: row.leave_date ? String(row.leave_date) : null,
  remark: String(row.remark ?? ""),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

export const employeeRepository = {
  listByUnitId(unitId: number): Employee[] {
    const rows = database
      .prepare(
        `
          SELECT id, unit_id, employee_code, employee_name, id_number, hire_date, leave_date, remark, created_at, updated_at
          FROM employees
          WHERE unit_id = ?
          ORDER BY created_at DESC
        `,
      )
      .all(unitId) as Record<string, unknown>[];

    return rows.map(mapRowToEmployee);
  },
  getById(employeeId: number): Employee | null {
    const row = database
      .prepare(
        `
          SELECT id, unit_id, employee_code, employee_name, id_number, hire_date, leave_date, remark, created_at, updated_at
          FROM employees
          WHERE id = ?
        `,
      )
      .get(employeeId) as Record<string, unknown> | undefined;

    return row ? mapRowToEmployee(row) : null;
  },
  create(unitId: number, payload: CreateEmployeePayload): Employee {
    const now = new Date().toISOString();
    const result = database
      .prepare(
        `
          INSERT INTO employees (
            unit_id,
            employee_code,
            employee_name,
            id_number,
            hire_date,
            leave_date,
            remark,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        unitId,
        payload.employeeCode.trim(),
        payload.employeeName.trim(),
        payload.idNumber.trim(),
        payload.hireDate || null,
        payload.leaveDate || null,
        payload.remark?.trim() ?? "",
        now,
        now,
      );

    return this.getById(Number(result.lastInsertRowid)) as Employee;
  },
  update(employeeId: number, payload: UpdateEmployeePayload): Employee {
    const now = new Date().toISOString();
    database
      .prepare(
        `
          UPDATE employees
          SET employee_code = ?,
              employee_name = ?,
              id_number = ?,
              hire_date = ?,
              leave_date = ?,
              remark = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        payload.employeeCode.trim(),
        payload.employeeName.trim(),
        payload.idNumber.trim(),
        payload.hireDate || null,
        payload.leaveDate || null,
        payload.remark?.trim() ?? "",
        now,
        employeeId,
      );

    return this.getById(employeeId) as Employee;
  },
  deleteById(employeeId: number) {
    database.prepare("DELETE FROM employees WHERE id = ?").run(employeeId);
  },
};

