import type {
  CreateEmployeePayload,
  Employee,
  EmployeeMonthRecord,
  ImportCommitResponse,
  ImportConflictStrategy,
  ImportPreviewResponse,
  ImportPreviewRow,
  ImportType,
  UpsertEmployeeMonthRecordPayload,
} from "@dude-tax/core";
import { database } from "../db/database.js";
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

const employeeTemplateChineseHeader = ["工号", "姓名", "证件号", "入职日期", "离职日期", "备注"];

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
  "supplementarySalaryIncome",
  "supplementaryWithheldTaxAdjustment",
  "supplementarySourcePeriodLabel",
  "supplementaryRemark",
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

const monthRecordTemplateChineseHeader = [
  "工号",
  "年度",
  "月份",
  "记录状态",
  "工资收入",
  "年终奖",
  "养老保险",
  "医疗保险",
  "职业年金",
  "住房公积金",
  "补充住房公积金",
  "失业保险",
  "工伤保险",
  "已预扣税额",
  "补发收入",
  "补扣税调整",
  "补发所属期间",
  "补发备注",
  "婴幼儿照护扣除",
  "子女教育扣除",
  "继续教育扣除",
  "住房贷款利息扣除",
  "住房租金扣除",
  "赡养老人扣除",
  "其他扣除",
  "减免税额",
  "备注",
];

const monthRecordTemplateWithReferenceHeader = [
  "employeeCode",
  "employeeName",
  "idNumber",
  ...monthRecordTemplateHeader.slice(1),
];

const monthRecordTemplateWithReferenceChineseHeader = [
  "工号",
  "姓名",
  "证件号",
  ...monthRecordTemplateChineseHeader.slice(1),
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
  | "supplementarySalaryIncome"
  | "supplementaryWithheldTaxAdjustment"
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

type ParsedCsvRow = {
  rowNumber: number;
  values: string[];
};

type ParsedCsvData = {
  headers: string[];
  rows: ParsedCsvRow[];
};

type EmployeeImportAnalysisRow = {
  rowNumber: number;
  parsedData: Record<string, unknown>;
  payload: ParsedEmployeeRow;
  previewRow: ImportPreviewRow;
  matchedByCode: Employee | null;
  matchedByIdNumber: Employee | null;
};

type MonthRecordImportAnalysisRow = {
  rowNumber: number;
  parsedData: Record<string, unknown>;
  payload: ParsedMonthRecordRow;
  previewRow: ImportPreviewRow;
  employee: Employee | null;
  existingRecord: EmployeeMonthRecord | null;
};

type EmployeeImportAnalysis = {
  preview: ImportPreviewResponse;
  rows: EmployeeImportAnalysisRow[];
};

type MonthRecordImportAnalysis = {
  preview: ImportPreviewResponse;
  rows: MonthRecordImportAnalysisRow[];
};

type ImportAnalysis = EmployeeImportAnalysis | MonthRecordImportAnalysis;

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
  "supplementarySalaryIncome",
  "supplementaryWithheldTaxAdjustment",
  "infantCareDeduction",
  "childEducationDeduction",
  "continuingEducationDeduction",
  "housingLoanInterestDeduction",
  "housingRentDeduction",
  "elderCareDeduction",
  "otherDeduction",
  "taxReductionExemption",
];

const isRowEmpty = (row: string[]) => row.every((value) => !value.trim());

const parseCsv = (csvText: string): ParsedCsvData => {
  const parsedRows: string[][] = [];
  const normalizedText = csvText.replace(/^\uFEFF/, "");
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index]!;

    if (inQuotes) {
      if (character === '"') {
        const nextCharacter = normalizedText[index + 1];
        if (nextCharacter === '"') {
          currentValue += '"';
          index += 1;
          continue;
        }

        inQuotes = false;
        continue;
      }

      currentValue += character;
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if (character === "\r" || character === "\n") {
      currentRow.push(currentValue.trim());
      currentValue = "";

      if (!isRowEmpty(currentRow)) {
        parsedRows.push(currentRow);
      }

      currentRow = [];

      if (character === "\r" && normalizedText[index + 1] === "\n") {
        index += 1;
      }

      continue;
    }

    currentValue += character;
  }

  if (currentValue.length || currentRow.length) {
    currentRow.push(currentValue.trim());
    if (!isRowEmpty(currentRow)) {
      parsedRows.push(currentRow);
    }
  }

  if (!parsedRows.length) {
    return { headers: [], rows: [] };
  }

  const headers = parsedRows[0]!.map((item) => item.trim());
  const rows = parsedRows.slice(1).map((values, index) => ({ rowNumber: index + 2, values }));
  return { headers, rows };
};

const parseNumber = (value: string) => {
  const nextValue = Number(value || 0);
  return Number.isNaN(nextValue) ? null : nextValue;
};

const normalizeImportHeaders = (
  headers: string[],
  candidates: Array<{ englishHeaders: string[]; chineseHeaders: string[]; normalizedHeaders: string[] }>,
) => {
  for (const candidate of candidates) {
    if (headers.join(",") === candidate.englishHeaders.join(",")) {
      return {
        matched: true,
        normalizedHeaders: candidate.normalizedHeaders,
      };
    }

    if (headers.join(",") === candidate.chineseHeaders.join(",")) {
      return {
        matched: true,
        normalizedHeaders: candidate.normalizedHeaders,
      };
    }
  }

  return {
    matched: false,
    normalizedHeaders: headers,
  };
};

const buildTemplate = (importType: ImportType, unitId?: number, taxYear?: number) => {
  if (importType === "employee") {
    return `${employeeTemplateChineseHeader.join(",")}\n`;
  }

  const rows =
    unitId && Number.isInteger(unitId) && unitId > 0
      ? employeeRepository.listByUnitId(unitId)
      : [];
  const templateTaxYear = taxYear && Number.isInteger(taxYear) ? taxYear : "";
  const headerLine = `${monthRecordTemplateWithReferenceChineseHeader.join(",")}\n`;
  const body =
    rows.length > 0
      ? rows
          .map((employee) =>
            [
              employee.employeeCode,
              employee.employeeName,
              employee.idNumber,
              templateTaxYear,
              "",
              "completed",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              employee.remark ?? "",
            ].join(","),
          )
          .join("\n")
      : "";

  return `${headerLine}${body}${body ? "\n" : ""}`;
};

const parseEmployeeRow = (headers: string[], values: string[]) => {
  const errors: string[] = [];
  const { matched, normalizedHeaders } = normalizeImportHeaders(
    headers,
    [
      {
        englishHeaders: employeeTemplateHeader,
        chineseHeaders: employeeTemplateChineseHeader,
        normalizedHeaders: employeeTemplateHeader,
      },
    ],
  );
  const parsedData = Object.fromEntries(
    normalizedHeaders.map((header, index) => [header, values[index] ?? ""]),
  );

  if (!matched) {
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
  const { matched, normalizedHeaders } = normalizeImportHeaders(
    headers,
    [
      {
        englishHeaders: monthRecordTemplateHeader,
        chineseHeaders: monthRecordTemplateChineseHeader,
        normalizedHeaders: monthRecordTemplateHeader,
      },
      {
        englishHeaders: monthRecordTemplateWithReferenceHeader,
        chineseHeaders: monthRecordTemplateWithReferenceChineseHeader,
        normalizedHeaders: monthRecordTemplateWithReferenceHeader,
      },
    ],
  );
  const parsedData = Object.fromEntries(
    normalizedHeaders.map((header, index) => [header, values[index] ?? ""]),
  );

  if (!matched) {
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
    supplementarySalaryIncome: 0,
    supplementaryWithheldTaxAdjustment: 0,
    supplementarySourcePeriodLabel: String(parsedData.supplementarySourcePeriodLabel ?? "").trim(),
    supplementaryRemark: String(parsedData.supplementaryRemark ?? "").trim(),
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

  numericPayloadFields.forEach((field) => {
    const nextValue = parseNumber(String(parsedData[field] ?? ""));
    if (nextValue === null || nextValue < 0) {
      errors.push(`${field} 必须为大于等于 0 的数字`);
      return;
    }
    monthPayload[field] = nextValue;
  });

  if ((monthPayload.supplementarySourcePeriodLabel ?? "").length > 100) {
    errors.push("supplementarySourcePeriodLabel 不能超过 100 个字符");
  }

  if ((monthPayload.supplementaryRemark ?? "").length > 300) {
    errors.push("supplementaryRemark 不能超过 300 个字符");
  }

  return {
    errors,
    parsedData,
    payload: {
      employeeCode: String(parsedData.employeeCode ?? "").trim(),
      taxYear: taxYear ?? 0,
      taxMonth: taxMonth ?? 0,
      ...monthPayload,
    } satisfies ParsedMonthRecordRow,
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

const buildMonthRecordKey = (employeeId: number, taxYear: number, taxMonth: number) =>
  `${employeeId}:${taxYear}:${taxMonth}`;

const buildEmployeeImportAnalysis = (
  unitId: number,
  parsedCsv: ParsedCsvData,
): EmployeeImportAnalysis => {
  const existingEmployees = employeeRepository.listByUnitId(unitId);
  const employeesByCode = new Map(
    existingEmployees.map((employee) => [employee.employeeCode, employee]),
  );
  const employeesByIdNumber = new Map(
    existingEmployees.map((employee) => [employee.idNumber, employee]),
  );
  const seenEmployeeCodes = new Set<string>();
  const seenEmployeeIdNumbers = new Set<string>();

  const rows = parsedCsv.rows.map((row) => {
    const { errors, payload, parsedData } = parseEmployeeRow(parsedCsv.headers, row.values);

    if (!errors.length) {
      if (seenEmployeeCodes.has(payload.employeeCode)) {
        errors.push("同一导入文件内工号重复");
      } else {
        seenEmployeeCodes.add(payload.employeeCode);
      }

      if (seenEmployeeIdNumbers.has(payload.idNumber)) {
        errors.push("同一导入文件内证件号重复");
      } else {
        seenEmployeeIdNumbers.add(payload.idNumber);
      }
    }

    const matchedByCode = employeesByCode.get(payload.employeeCode) ?? null;
    const matchedByIdNumber = employeesByIdNumber.get(payload.idNumber) ?? null;

    let previewRow: ImportPreviewRow;

    if (errors.length) {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "error",
        conflictType: null,
        errors,
        parsedData,
      };
    } else if (matchedByCode && matchedByIdNumber && matchedByCode.id !== matchedByIdNumber.id) {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "error",
        conflictType: null,
        errors: ["工号和证件号分别命中不同员工，无法自动覆盖"],
        parsedData,
      };
    } else if (matchedByCode || matchedByIdNumber) {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "conflict",
        conflictType: matchedByCode ? "employee_code_conflict" : "id_number_conflict",
        errors: [],
        parsedData,
      };
    } else {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "ready",
        conflictType: null,
        errors: [],
        parsedData,
      };
    }

    return {
      rowNumber: row.rowNumber,
      parsedData,
      payload,
      previewRow,
      matchedByCode,
      matchedByIdNumber,
    };
  });

  return {
    preview: summarizePreview(
      "employee",
      rows.map((row) => row.previewRow),
    ),
    rows,
  };
};

const buildMonthRecordImportAnalysis = (
  unitId: number,
  parsedCsv: ParsedCsvData,
  scopeTaxYear?: number,
): MonthRecordImportAnalysis => {
  const employeeList = employeeRepository.listByUnitId(unitId);
  const employeesByCode = new Map(
    employeeList.map((employee) => [employee.employeeCode, employee]),
  );
  const preParsedRows = parsedCsv.rows.map((row) => ({
    rowNumber: row.rowNumber,
    ...parseMonthRecordRow(parsedCsv.headers, row.values),
  }));
  const taxYears = Array.from(
    new Set(
      preParsedRows
        .filter(
          (row) =>
            !row.errors.length &&
            Number.isInteger(row.payload.taxYear) &&
            row.payload.taxYear >= 2000,
        )
        .map((row) => row.payload.taxYear),
    ),
  );
  const existingMonthRecords = monthRecordRepository.listExistingByUnitAndYears(unitId, taxYears);
  const monthRecordsByKey = new Map(
    existingMonthRecords.map((record) => [
      buildMonthRecordKey(record.employeeId, record.taxYear, record.taxMonth),
      record,
    ]),
  );
  const seenMonthKeys = new Set<string>();

  const rows = preParsedRows.map((row) => {
    const errors = [...row.errors];

    if (!errors.length && scopeTaxYear && row.payload.taxYear !== scopeTaxYear) {
      errors.push(`当前年份为 ${scopeTaxYear}，仅允许导入该年度月度数据`);
    }

    if (!errors.length) {
      const fileMonthKey = `${row.payload.employeeCode}:${row.payload.taxYear}:${row.payload.taxMonth}`;
      if (seenMonthKeys.has(fileMonthKey)) {
        errors.push("同一导入文件内存在重复的员工年度月份记录");
      } else {
        seenMonthKeys.add(fileMonthKey);
      }
    }

    const employee = employeesByCode.get(row.payload.employeeCode) ?? null;
    const existingRecord = employee
      ? (monthRecordsByKey.get(
          buildMonthRecordKey(employee.id, row.payload.taxYear, row.payload.taxMonth),
        ) ?? null)
      : null;

    let previewRow: ImportPreviewRow;

    if (errors.length) {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "error",
        conflictType: null,
        errors,
        parsedData: row.parsedData,
      };
    } else if (!employee) {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "error",
        conflictType: null,
        errors: ["员工工号不存在"],
        parsedData: row.parsedData,
      };
    } else if (existingRecord) {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "conflict",
        conflictType: "month_record_conflict",
        errors: [],
        parsedData: row.parsedData,
      };
    } else {
      previewRow = {
        rowNumber: row.rowNumber,
        status: "ready",
        conflictType: null,
        errors: [],
        parsedData: row.parsedData,
      };
    }

    return {
      rowNumber: row.rowNumber,
      parsedData: row.parsedData,
      payload: row.payload,
      previewRow,
      employee,
      existingRecord,
    };
  });

  return {
    preview: summarizePreview(
      "month_record",
      rows.map((row) => row.previewRow),
    ),
    rows,
  };
};

const buildImportAnalysis = (
  importType: ImportType,
  unitId: number,
  csvText: string,
  scopeTaxYear?: number,
): ImportAnalysis => {
  const parsedCsv = parseCsv(csvText);

  if (importType === "employee") {
    return buildEmployeeImportAnalysis(unitId, parsedCsv);
  }

  return buildMonthRecordImportAnalysis(unitId, parsedCsv, scopeTaxYear);
};

const buildBlockingFailures = (
  previewRows: ImportPreviewRow[],
  conflictStrategy: ImportConflictStrategy,
): ImportCommitResponse["failures"] =>
  previewRows
    .filter(
      (row) =>
        row.status === "error" || (row.status === "conflict" && conflictStrategy !== "overwrite"),
    )
    .map((row) => ({
      rowNumber: row.rowNumber,
      reason:
        row.status === "error"
          ? row.errors.join("；")
          : conflictStrategy === "skip"
            ? "当前导入采用全成功提交策略，存在冲突时请改用 overwrite 或先处理冲突"
            : (row.conflictType ?? "冲突"),
    }));

export const importService = {
  getTemplate(importType: ImportType, unitId?: number, taxYear?: number) {
    return buildTemplate(importType, unitId, taxYear);
  },
  preview(
    importType: ImportType,
    unitId: number,
    csvText: string,
    scopeTaxYear?: number,
  ): ImportPreviewResponse {
    const analysis = buildImportAnalysis(importType, unitId, csvText, scopeTaxYear);
    importSummaryRepository.savePreview(unitId, importType, analysis.preview);
    return analysis.preview;
  },
  commit(
    importType: ImportType,
    unitId: number,
    csvText: string,
    conflictStrategy: ImportConflictStrategy,
    scopeTaxYear?: number,
  ): ImportCommitResponse {
    const analysis = buildImportAnalysis(importType, unitId, csvText, scopeTaxYear);
    importSummaryRepository.savePreview(unitId, importType, analysis.preview);

    const blockingFailures = buildBlockingFailures(analysis.preview.rows, conflictStrategy);
    if (blockingFailures.length) {
      return {
        importType,
        totalRows: analysis.preview.totalRows,
        successCount: 0,
        skippedCount: 0,
        failureCount: blockingFailures.length,
        failures: blockingFailures,
      };
    }

    const commitTransaction = database.transaction(() => {
      if (importType === "employee") {
        const employeeRows = (analysis as EmployeeImportAnalysis).rows;
        employeeRows.forEach((row) => {
          if (row.previewRow.status === "conflict") {
            const targetEmployee = row.matchedByCode ?? row.matchedByIdNumber;
            if (!targetEmployee) {
              throw new Error(`员工导入计划异常：未找到可覆盖员工，行号 ${row.rowNumber}`);
            }
            employeeRepository.update(targetEmployee.id, row.payload);
            return;
          }

          employeeRepository.create(unitId, row.payload);
        });
        return employeeRows.length;
      }

      const monthRecordRows = (analysis as MonthRecordImportAnalysis).rows;
      monthRecordRows.forEach((row) => {
        if (!row.employee) {
          throw new Error(`月度导入计划异常：未找到员工，行号 ${row.rowNumber}`);
        }

        monthRecordRepository.upsert(
          unitId,
          row.employee.id,
          row.payload.taxYear,
          row.payload.taxMonth,
          row.payload,
        );
      });
      return monthRecordRows.length;
    });

    const successCount = commitTransaction();
    importSummaryRepository.clearByUnitId(unitId);

    return {
      importType,
      totalRows: analysis.preview.totalRows,
      successCount,
      skippedCount: 0,
      failureCount: 0,
      failures: [],
    };
  },
};
