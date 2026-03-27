import type {
  CreateEmployeePayload,
  ImportCommitResponse,
  ImportConflictStrategy,
  ImportPreviewResponse,
  ImportPreviewRow,
  ImportType,
  UpsertEmployeeMonthRecordPayload,
} from "../../../../packages/core/src/index.js";
import { employeeRepository } from "../repositories/employee-repository.js";
import { importSummaryRepository } from "../repositories/import-summary-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";

const employeeTemplateHeader = [
  "employeeCode",
  "employeeName",
  "idNumber",
  "hireDate",
  "leaveDate",
  "remark",
];

const monthRecordTemplateHeader = [
  "employeeCode",
  "taxYear",
  "taxMonth",
  "status",
  "salaryIncome",
  "annualBonus",
  "pensionInsurance",
  "medicalInsurance",
  "occupationalAnnuity",
  "housingFund",
  "supplementaryHousingFund",
  "unemploymentInsurance",
  "workInjuryInsurance",
  "withheldTax",
  "infantCareDeduction",
  "childEducationDeduction",
  "continuingEducationDeduction",
  "housingLoanInterestDeduction",
  "housingRentDeduction",
  "elderCareDeduction",
  "otherDeduction",
  "taxReductionExemption",
  "remark",
];

type NumericMonthRecordField =
  | "salaryIncome"
  | "annualBonus"
  | "pensionInsurance"
  | "medicalInsurance"
  | "occupationalAnnuity"
  | "housingFund"
  | "supplementaryHousingFund"
  | "unemploymentInsurance"
  | "workInjuryInsurance"
  | "withheldTax"
  | "infantCareDeduction"
  | "childEducationDeduction"
  | "continuingEducationDeduction"
  | "housingLoanInterestDeduction"
  | "housingRentDeduction"
  | "elderCareDeduction"
  | "otherDeduction"
  | "taxReductionExemption";

type ParsedEmployeeRow = CreateEmployeePayload;
type ParsedMonthRecordRow = UpsertEmployeeMonthRecordPayload & {
  employeeCode: string;
  taxYear: number;
  taxMonth: number;
};

const parseCsv = (csvText: string) => {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      headers: [],
      rows: [],
    };
  }

  const headers = lines[0]!.split(",").map((item) => item.trim());
  const rows = lines.slice(1).map((line, index) => ({
    rowNumber: index + 2,
    values: line.split(",").map((item) => item.trim()),
  }));

  return {
    headers,
    rows,
  };
};

const parseNumber = (value: string) => {
  const nextValue = Number(value || 0);
  return Number.isNaN(nextValue) ? null : nextValue;
};

const buildTemplate = (importType: ImportType) =>
  importType === "employee"
    ? `${employeeTemplateHeader.join(",")}\n`
    : `${monthRecordTemplateHeader.join(",")}\n`;

const parseEmployeeRow = (headers: string[], values: string[]) => {
  const errors: string[] = [];
  const parsedData = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

  if (headers.join(",") !== employeeTemplateHeader.join(",")) {
    errors.push("员工模板表头不正确");
  }

  if (!String(parsedData.employeeCode ?? "").trim()) {
    errors.push("工号不能为空");
  }
  if (!String(parsedData.employeeName ?? "").trim()) {
    errors.push("姓名不能为空");
  }
  if (!String(parsedData.idNumber ?? "").trim()) {
    errors.push("证件号不能为空");
  }

  return {
    errors,
    parsedData,
    payload: {
      employeeCode: String(parsedData.employeeCode ?? "").trim(),
      employeeName: String(parsedData.employeeName ?? "").trim(),
      idNumber: String(parsedData.idNumber ?? "").trim(),
      hireDate: String(parsedData.hireDate ?? "").trim() || null,
      leaveDate: String(parsedData.leaveDate ?? "").trim() || null,
      remark: String(parsedData.remark ?? "").trim(),
    } satisfies ParsedEmployeeRow,
  };
};

const parseMonthRecordRow = (headers: string[], values: string[]) => {
  const errors: string[] = [];
  const parsedData = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

  if (headers.join(",") !== monthRecordTemplateHeader.join(",")) {
    errors.push("月度数据模板表头不正确");
  }

  const taxYear = parseNumber(String(parsedData.taxYear ?? ""));
  const taxMonth = parseNumber(String(parsedData.taxMonth ?? ""));
  const status = String(parsedData.status ?? "").trim() || "incomplete";

  if (!String(parsedData.employeeCode ?? "").trim()) {
    errors.push("工号不能为空");
  }
  if (!taxYear || !Number.isInteger(taxYear)) {
    errors.push("年度必须为整数");
  }
  if (!taxMonth || !Number.isInteger(taxMonth) || taxMonth < 1 || taxMonth > 12) {
    errors.push("月份必须在 1 到 12 之间");
  }
  if (!["incomplete", "completed"].includes(status)) {
    errors.push("状态必须为 incomplete 或 completed");
  }

  const numericPayloadFields: NumericMonthRecordField[] = [
    "salaryIncome",
    "annualBonus",
    "pensionInsurance",
    "medicalInsurance",
    "occupationalAnnuity",
    "housingFund",
    "supplementaryHousingFund",
    "unemploymentInsurance",
    "workInjuryInsurance",
    "withheldTax",
    "infantCareDeduction",
    "childEducationDeduction",
    "continuingEducationDeduction",
    "housingLoanInterestDeduction",
    "housingRentDeduction",
    "elderCareDeduction",
    "otherDeduction",
    "taxReductionExemption",
  ];

  const monthPayload: UpsertEmployeeMonthRecordPayload = {
    status: status as UpsertEmployeeMonthRecordPayload["status"],
    salaryIncome: 0,
    annualBonus: 0,
    pensionInsurance: 0,
    medicalInsurance: 0,
    occupationalAnnuity: 0,
    housingFund: 0,
    supplementaryHousingFund: 0,
    unemploymentInsurance: 0,
    workInjuryInsurance: 0,
    withheldTax: 0,
    infantCareDeduction: 0,
    childEducationDeduction: 0,
    continuingEducationDeduction: 0,
    housingLoanInterestDeduction: 0,
    housingRentDeduction: 0,
    elderCareDeduction: 0,
    otherDeduction: 0,
    taxReductionExemption: 0,
    remark: String(parsedData.remark ?? "").trim(),
  };

  const payloadBase = {
    employeeCode: String(parsedData.employeeCode ?? "").trim(),
    taxYear: taxYear ?? 0,
    taxMonth: taxMonth ?? 0,
  };

  numericPayloadFields.forEach((field) => {
    const nextValue = parseNumber(String(parsedData[field] ?? ""));
    if (nextValue === null || nextValue < 0) {
      errors.push(`${field} 必须为大于等于 0 的数字`);
      return;
    }
    monthPayload[field] = nextValue;
  });

  return {
    errors,
    parsedData,
    payload: {
      ...payloadBase,
      ...monthPayload,
    },
  };
};

const buildEmployeePreviewRow = (
  unitId: number,
  rowNumber: number,
  payload: ParsedEmployeeRow,
  errors: string[],
  parsedData: Record<string, unknown>,
): ImportPreviewRow => {
  if (errors.length) {
    return {
      rowNumber,
      status: "error",
      conflictType: null,
      errors,
      parsedData,
    };
  }

  const employees = employeeRepository.listByUnitId(unitId);
  const codeConflict = employees.some((employee) => employee.employeeCode === payload.employeeCode);
  const idConflict = employees.some((employee) => employee.idNumber === payload.idNumber);

  if (codeConflict || idConflict) {
    return {
      rowNumber,
      status: "conflict",
      conflictType: codeConflict ? "employee_code_conflict" : "id_number_conflict",
      errors: [],
      parsedData,
    };
  }

  return {
    rowNumber,
    status: "ready",
    conflictType: null,
    errors: [],
    parsedData,
  };
};

const buildMonthRecordPreviewRow = (
  unitId: number,
  rowNumber: number,
  payload: ParsedMonthRecordRow,
  errors: string[],
  parsedData: Record<string, unknown>,
): ImportPreviewRow => {
  if (errors.length) {
    return {
      rowNumber,
      status: "error",
      conflictType: null,
      errors,
      parsedData,
    };
  }

  const employee = employeeRepository
    .listByUnitId(unitId)
    .find((item) => item.employeeCode === payload.employeeCode);

  if (!employee) {
    return {
      rowNumber,
      status: "error",
      conflictType: null,
      errors: ["员工工号不存在"],
      parsedData,
    };
  }

  const monthRecord = monthRecordRepository
    .listByEmployeeAndYear(unitId, employee.id, payload.taxYear)
    .find((record) => record.taxMonth === payload.taxMonth && record.id !== null);

  if (monthRecord) {
    return {
      rowNumber,
      status: "conflict",
      conflictType: "month_record_conflict",
      errors: [],
      parsedData,
    };
  }

  return {
    rowNumber,
    status: "ready",
    conflictType: null,
    errors: [],
    parsedData,
  };
};

const summarizePreview = (
  importType: ImportType,
  rows: ImportPreviewRow[],
): ImportPreviewResponse => ({
  importType,
  totalRows: rows.length,
  readyRows: rows.filter((row) => row.status === "ready").length,
  conflictRows: rows.filter((row) => row.status === "conflict").length,
  errorRows: rows.filter((row) => row.status === "error").length,
  rows,
});

export const importService = {
  getTemplate(importType: ImportType) {
    return buildTemplate(importType);
  },
  preview(importType: ImportType, unitId: number, csvText: string): ImportPreviewResponse {
    const { headers, rows } = parseCsv(csvText);

    const previewRows = rows.map((row) => {
      if (importType === "employee") {
        const { errors, payload, parsedData } = parseEmployeeRow(headers, row.values);
        return buildEmployeePreviewRow(unitId, row.rowNumber, payload, errors, parsedData);
      }

      const { errors, payload, parsedData } = parseMonthRecordRow(headers, row.values);
      return buildMonthRecordPreviewRow(unitId, row.rowNumber, payload, errors, parsedData);
    });

    const preview = summarizePreview(importType, previewRows);
    importSummaryRepository.savePreview(unitId, importType, preview);
    return preview;
  },
  commit(
    importType: ImportType,
    unitId: number,
    csvText: string,
    conflictStrategy: ImportConflictStrategy,
  ): ImportCommitResponse {
    const preview = this.preview(importType, unitId, csvText);
    const failures: ImportCommitResponse["failures"] = [];
    let successCount = 0;
    let skippedCount = 0;

    if (conflictStrategy === "abort" && preview.rows.some((row) => row.status === "conflict")) {
      return {
        importType,
        totalRows: preview.totalRows,
        successCount: 0,
        skippedCount: 0,
        failureCount: preview.conflictRows,
        failures: preview.rows
          .filter((row) => row.status === "conflict")
          .map((row) => ({
            rowNumber: row.rowNumber,
            reason: row.conflictType ?? "冲突",
          })),
      };
    }

    const { headers, rows } = parseCsv(csvText);

    rows.forEach((row) => {
      const previewRow = preview.rows.find((item) => item.rowNumber === row.rowNumber);
      if (!previewRow) {
        return;
      }

      if (previewRow.status === "error") {
        failures.push({
          rowNumber: row.rowNumber,
          reason: previewRow.errors.join("；"),
        });
        return;
      }

      if (previewRow.status === "conflict" && conflictStrategy === "skip") {
        skippedCount += 1;
        return;
      }

      if (importType === "employee") {
        const { payload } = parseEmployeeRow(headers, row.values);
        const existingEmployees = employeeRepository.listByUnitId(unitId);
        const matchedByCode = existingEmployees.find((employee) => employee.employeeCode === payload.employeeCode) ?? null;
        const matchedByIdNumber = existingEmployees.find((employee) => employee.idNumber === payload.idNumber) ?? null;

        if (previewRow.status === "conflict" && conflictStrategy === "overwrite") {
          if (
            matchedByCode &&
            matchedByIdNumber &&
            matchedByCode.id !== matchedByIdNumber.id
          ) {
            failures.push({
              rowNumber: row.rowNumber,
              reason: "工号和证件号分别命中不同员工，无法覆盖",
            });
            return;
          }

          const targetEmployee = matchedByCode ?? matchedByIdNumber;
          if (!targetEmployee) {
            failures.push({
              rowNumber: row.rowNumber,
              reason: "未找到可覆盖的员工记录",
            });
            return;
          }

          employeeRepository.update(targetEmployee.id, payload);
          successCount += 1;
          return;
        }

        employeeRepository.create(unitId, payload);
        successCount += 1;
        return;
      }

      const { payload } = parseMonthRecordRow(headers, row.values);
      const employee = employeeRepository
        .listByUnitId(unitId)
        .find((item) => item.employeeCode === payload.employeeCode);

      if (!employee) {
        failures.push({
          rowNumber: row.rowNumber,
          reason: "员工工号不存在",
        });
        return;
      }

      if (previewRow.status === "conflict" && conflictStrategy === "overwrite") {
        monthRecordRepository.upsert(unitId, employee.id, payload.taxYear, payload.taxMonth, payload);
        successCount += 1;
        return;
      }

      monthRecordRepository.upsert(unitId, employee.id, payload.taxYear, payload.taxMonth, payload);
      successCount += 1;
    });

    const result = {
      importType,
      totalRows: preview.totalRows,
      successCount,
      skippedCount,
      failureCount: failures.length,
      failures,
    };

    const latestPreview = this.preview(importType, unitId, csvText);
    importSummaryRepository.savePreview(unitId, importType, latestPreview);

    return result;
  },
};
