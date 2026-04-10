import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

const DEFAULT_PHASE_PROFILE = "desktop-full-chain";
const PHASE_DEFINITIONS = [
  { key: "baseline", label: "基线", weight: 5 },
  { key: "burst", label: "重算 burst", weight: 10 },
  { key: "queryRamp", label: "查询 ramp", weight: 15 },
  { key: "steadyState", label: "混合 steady-state", weight: 20 },
  { key: "recovery", label: "恢复阶段", weight: 10 },
];

const EMPLOYEE_HEADERS = [
  "employeeCode",
  "employeeName",
  "idNumber",
  "hireDate",
  "leaveDate",
  "remark",
];

const MONTH_RECORD_HEADERS = [
  "employeeCode",
  "taxYear",
  "taxMonth",
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
  "otherIncome",
  "otherIncomeRemark",
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
};

const buildCsvLine = (values) => values.map((value) => escapeCsvValue(value)).join(",");

const summarizePreview = (preview) => ({
  importType: preview.importType,
  totalRows: preview.totalRows,
  readyRows: preview.readyRows,
  conflictRows: preview.conflictRows,
  errorRows: preview.errorRows,
  autoFillZeroEmployeeCount: preview.autoFillZeroEmployeeCount ?? 0,
  autoFillZeroRowCount: preview.autoFillZeroRowCount ?? 0,
});

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`不支持的位置参数：${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：--${key}`);
    }

    args[key] = value;
    index += 1;
  }

  const durationMinutes = Number(args["duration-minutes"]);
  const seedEmployees = Number(args["seed-employees"]);
  const taxYear = Number(args["tax-year"]);
  const apiBaseUrl = String(args["api-base-url"] ?? "").trim().replace(/\/+$/, "");
  const dbPath = String(args["db-path"] ?? "").trim();
  const unitName = String(args["unit-name"] ?? "").trim();
  const outputDir = String(args["output-dir"] ?? "").trim();
  const phaseProfile = String(args["phase-profile"] ?? DEFAULT_PHASE_PROFILE).trim();

  if (!apiBaseUrl) {
    throw new Error("缺少参数 --api-base-url");
  }
  if (!dbPath) {
    throw new Error("缺少参数 --db-path");
  }
  if (!outputDir) {
    throw new Error("缺少参数 --output-dir");
  }
  if (!unitName) {
    throw new Error("缺少参数 --unit-name");
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("--duration-minutes 必须为大于 0 的数字");
  }
  if (!Number.isInteger(seedEmployees) || seedEmployees <= 0) {
    throw new Error("--seed-employees 必须为正整数");
  }
  if (!Number.isInteger(taxYear) || taxYear < 1900) {
    throw new Error("--tax-year 必须为大于等于 1900 的整数");
  }
  if (phaseProfile !== DEFAULT_PHASE_PROFILE) {
    throw new Error(`不支持的 --phase-profile：${phaseProfile}`);
  }

  return {
    durationMinutes,
    seedEmployees,
    taxYear,
    apiBaseUrl,
    dbPath: path.resolve(dbPath),
    unitName,
    outputDir: path.resolve(outputDir),
    phaseProfile,
  };
};

const requestJson = async (apiBaseUrl, requestPath, init = {}) => {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    ...init,
    headers,
  });
  const responseText = await response.text();
  const responseJson = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(responseJson?.message ?? `${init.method ?? "GET"} ${requestPath} 失败`);
  }

  return responseJson;
};

const requestJsonWithRetry = async (
  apiBaseUrl,
  requestPath,
  init = {},
  retryWindowMs = 30_000,
) => {
  const deadline = Date.now() + retryWindowMs;
  let lastError = null;

  while (Date.now() <= deadline) {
    try {
      return await requestJson(apiBaseUrl, requestPath, init);
    } catch (error) {
      lastError = error;
      await sleep(1_000);
    }
  }

  throw lastError ?? new Error(`${requestPath} 重试超时`);
};

const ensureDirectory = async (directoryPath) => {
  await fsp.mkdir(directoryPath, { recursive: true });
};

const writeJsonFile = async (filePath, value) => {
  await ensureDirectory(path.dirname(filePath));
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeTextFile = async (filePath, value) => {
  await ensureDirectory(path.dirname(filePath));
  await fsp.writeFile(filePath, value, "utf8");
};

const buildEmployeeCsv = (seedEmployees) => {
  const employees = Array.from({ length: seedEmployees }, (_, index) => {
    const numeric = String(index + 1).padStart(4, "0");
    const identity = String(100000 + index).slice(-6);
    return {
      employeeCode: `EMP-${numeric}`,
      employeeName: `压测员工${index + 1}`,
      idNumber: `110101199001${identity}`,
      hireDate: "2026-01-01",
      leaveDate: "",
      remark: "",
    };
  });

  const lines = [
    buildCsvLine(EMPLOYEE_HEADERS),
    ...employees.map((employee) =>
      buildCsvLine([
        employee.employeeCode,
        employee.employeeName,
        employee.idNumber,
        employee.hireDate,
        employee.leaveDate,
        employee.remark,
      ]),
    ),
  ];

  return {
    csvText: `${lines.join("\n")}\n`,
    employees,
  };
};

const buildMonthRecordCsv = (employees, taxYear) => {
  const lines = [buildCsvLine(MONTH_RECORD_HEADERS)];

  employees.forEach((employee, employeeIndex) => {
    for (let taxMonth = 1; taxMonth <= 12; taxMonth += 1) {
      const salaryIncome = 12_000 + (employeeIndex % 9) * 500 + taxMonth * 10;
      const withheldTax = 300 + (employeeIndex % 5) * 20;
      const annualBonus = taxMonth === 1 ? 12_000 + (employeeIndex % 6) * 1_000 : 0;
      lines.push(
        buildCsvLine([
          employee.employeeCode,
          taxYear,
          taxMonth,
          salaryIncome,
          annualBonus,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          withheldTax,
          0,
          "",
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          "",
        ]),
      );
    }
  });

  return `${lines.join("\n")}\n`;
};

const collectDbStats = (dbPath) => {
  const stats = {
    dbBytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    walBytes: fs.existsSync(`${dbPath}-wal`) ? fs.statSync(`${dbPath}-wal`).size : 0,
    shmBytes: fs.existsSync(`${dbPath}-shm`) ? fs.statSync(`${dbPath}-shm`).size : 0,
    annualResultCount: 0,
    annualResultVersionCount: 0,
    calculationRunCount: 0,
    monthRecordCount: 0,
    employeeCount: 0,
    unitCount: 0,
    confirmedMonthCount: 0,
  };

  if (!fs.existsSync(dbPath)) {
    return stats;
  }

  const database = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    stats.annualResultCount = Number(
      (database.prepare("SELECT COUNT(*) AS total FROM annual_tax_results").get() ?? { total: 0 }).total,
    );
    stats.annualResultVersionCount = Number(
      (
        database.prepare("SELECT COUNT(*) AS total FROM annual_tax_result_versions").get() ?? {
          total: 0,
        }
      ).total,
    );
    stats.calculationRunCount = Number(
      (
        database.prepare("SELECT COUNT(*) AS total FROM annual_calculation_runs").get() ?? {
          total: 0,
        }
      ).total,
    );
    stats.monthRecordCount = Number(
      (
        database.prepare("SELECT COUNT(*) AS total FROM employee_month_records").get() ?? {
          total: 0,
        }
      ).total,
    );
    stats.employeeCount = Number(
      (database.prepare("SELECT COUNT(*) AS total FROM employees").get() ?? { total: 0 }).total,
    );
    stats.unitCount = Number(
      (database.prepare("SELECT COUNT(*) AS total FROM units").get() ?? { total: 0 }).total,
    );
    stats.confirmedMonthCount = Number(
      (
        database.prepare("SELECT COUNT(*) AS total FROM month_confirmations").get() ?? {
          total: 0,
        }
      ).total,
    );
  } finally {
    database.close();
  }

  return stats;
};

const createMetricsRecorder = async (outputDir, dbPath, operationCounters, stateRef) => {
  let snapshotIndex = 0;
  let nextSnapshotAt = Date.now() + 60_000;

  return async (force = false) => {
    if (!force && Date.now() < nextSnapshotAt) {
      return;
    }

    snapshotIndex += 1;
    nextSnapshotAt = Date.now() + 60_000;
    const snapshot = {
      index: snapshotIndex,
      capturedAt: new Date().toISOString(),
      currentPhase: stateRef.currentPhase,
      operationCounters: { ...operationCounters },
      dbStats: collectDbStats(dbPath),
    };
    await writeJsonFile(path.join(outputDir, `metrics-${String(snapshotIndex).padStart(3, "0")}.json`), snapshot);
  };
};

const measureAsync = async (fn) => {
  const startedAt = performance.now();
  const result = await fn();
  return {
    result,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
  };
};

const collectQueryMetrics = async (apiBaseUrl, unitId, taxYear, employeeId) => {
  const confirmedList = await measureAsync(() =>
    requestJson(apiBaseUrl, `/api/units/${unitId}/years/${taxYear}/confirmed-results`),
  );
  const confirmedDetail = await measureAsync(() =>
    requestJson(
      apiBaseUrl,
      `/api/units/${unitId}/years/${taxYear}/confirmed-results/${employeeId}`,
    ),
  );
  const historyAll = await measureAsync(() =>
    requestJson(apiBaseUrl, `/api/history-results?unitId=${unitId}&taxYear=${taxYear}&resultStatus=all`),
  );
  const annualResults = await measureAsync(() =>
    requestJson(apiBaseUrl, `/api/units/${unitId}/years/${taxYear}/annual-results`),
  );

  return {
    latenciesMs: {
      confirmedResults: confirmedList.durationMs,
      confirmedResultDetail: confirmedDetail.durationMs,
      historyResults: historyAll.durationMs,
      annualResults: annualResults.durationMs,
    },
    rowCounts: {
      confirmedResults: confirmedList.result.length,
      confirmedDetailMonths: confirmedDetail.result.months.length,
      historyResults: historyAll.result.length,
      annualResults: annualResults.result.length,
    },
  };
};

const createUnitAndContext = async (apiBaseUrl, unitName, taxYear) => {
  const createdUnit = await requestJson(apiBaseUrl, "/api/units", {
    method: "POST",
    body: JSON.stringify({
      unitName: `${unitName}-${Date.now()}`,
      remark: "桌面端全链路长稳压测",
      startYear: taxYear,
    }),
  });

  await requestJson(apiBaseUrl, "/api/context", {
    method: "PUT",
    body: JSON.stringify({
      currentUnitId: createdUnit.id,
      currentTaxYear: taxYear,
    }),
  });

  return createdUnit;
};

const seedImportData = async (apiBaseUrl, outputDir, unitId, taxYear, seedEmployees) => {
  const employeeSeed = buildEmployeeCsv(seedEmployees);
  const employeeCsvPath = path.join(outputDir, "employees.csv");
  await writeTextFile(employeeCsvPath, employeeSeed.csvText);

  const employeePreview = await requestJson(apiBaseUrl, "/api/import/preview", {
    method: "POST",
    body: JSON.stringify({
      importType: "employee",
      unitId,
      csvText: employeeSeed.csvText,
    }),
  });

  const employeeCommit = await requestJson(apiBaseUrl, "/api/import/commit", {
    method: "POST",
    body: JSON.stringify({
      importType: "employee",
      unitId,
      csvText: employeeSeed.csvText,
      conflictStrategy: "overwrite",
    }),
  });

  const employees = await requestJson(apiBaseUrl, `/api/units/${unitId}/employees`);
  const monthRecordCsv = buildMonthRecordCsv(employees, taxYear);
  const monthRecordCsvPath = path.join(outputDir, "month-records.csv");
  await writeTextFile(monthRecordCsvPath, monthRecordCsv);

  const monthPreview = await requestJson(apiBaseUrl, "/api/import/preview", {
    method: "POST",
    body: JSON.stringify({
      importType: "month_record",
      unitId,
      scopeTaxYear: taxYear,
      csvText: monthRecordCsv,
    }),
  });

  const monthCommit = await requestJson(apiBaseUrl, "/api/import/commit", {
    method: "POST",
    body: JSON.stringify({
      importType: "month_record",
      unitId,
      scopeTaxYear: taxYear,
      csvText: monthRecordCsv,
      conflictStrategy: "overwrite",
    }),
  });

  return {
    employees,
    employeeCsvPath,
    monthRecordCsvPath,
    employeePreview,
    employeeCommit,
    monthPreview,
    monthCommit,
    employeeCsvText: employeeSeed.csvText,
    monthRecordCsvText: monthRecordCsv,
  };
};

const runBaselinePhase = async ({
  apiBaseUrl,
  outputDir,
  seedEmployees,
  taxYear,
  unitName,
}) => {
  const baselineStartedAt = performance.now();
  const unit = await createUnitAndContext(apiBaseUrl, unitName, taxYear);
  const seeded = await seedImportData(apiBaseUrl, outputDir, unit.id, taxYear, seedEmployees);
  const employeeIds = seeded.employees.map((employee) => employee.id);

  const calculateMetrics = await measureAsync(() =>
    requestJson(
      apiBaseUrl,
      `/api/units/${unit.id}/years/${taxYear}/year-entry-calculate`,
      {
        method: "POST",
        body: JSON.stringify({
          employeeIds,
        }),
      },
    ),
  );

  const confirmationLatencies = [];
  for (let taxMonth = 1; taxMonth <= 12; taxMonth += 1) {
    const confirmation = await measureAsync(() =>
      requestJson(
        apiBaseUrl,
        `/api/units/${unit.id}/years/${taxYear}/month-confirmations/${taxMonth}/confirm`,
        {
          method: "POST",
        },
      ),
    );
    confirmationLatencies.push({
      taxMonth,
      durationMs: confirmation.durationMs,
    });
  }

  const queryMetrics = await collectQueryMetrics(
    apiBaseUrl,
    unit.id,
    taxYear,
    employeeIds[0],
  );

  return {
    unit,
    employeeIds,
    employeeCsvPath: seeded.employeeCsvPath,
    monthRecordCsvPath: seeded.monthRecordCsvPath,
    employeeCsvText: seeded.employeeCsvText,
    monthRecordCsvText: seeded.monthRecordCsvText,
    metrics: {
      durationMs: Number((performance.now() - baselineStartedAt).toFixed(2)),
      importPreview: {
        employee: summarizePreview(seeded.employeePreview),
        monthRecord: summarizePreview(seeded.monthPreview),
      },
      importCommit: {
        employee: seeded.employeeCommit,
        monthRecord: seeded.monthCommit,
      },
      calculateMs: calculateMetrics.durationMs,
      confirmationLatencies,
      queryMetrics,
    },
  };
};

const runBurstPhase = async ({
  apiBaseUrl,
  unitId,
  taxYear,
  durationMs,
  operationCounters,
  recordSnapshot,
}) => {
  const beforeStats = collectDbStats(recordSnapshot.dbPath);
  const deadline = Date.now() + durationMs;
  let iterations = 0;
  let lastRecalculateLatencyMs = 0;

  while (Date.now() < deadline) {
    const recalculate = await measureAsync(() =>
      requestJson(
        apiBaseUrl,
        `/api/units/${unitId}/years/${taxYear}/calculation-statuses/recalculate`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ),
    );
    iterations += 1;
    operationCounters.recalculate += 1;
    lastRecalculateLatencyMs = recalculate.durationMs;
    await recordSnapshot();
  }

  const afterStats = collectDbStats(recordSnapshot.dbPath);
  return {
    iterations,
    lastRecalculateLatencyMs,
    beforeStats,
    afterStats,
    dbGrowthRate:
      beforeStats.dbBytes > 0
        ? Number((((afterStats.dbBytes - beforeStats.dbBytes) / beforeStats.dbBytes) * 100).toFixed(2))
        : 0,
  };
};

const runQueryRampPhase = async ({
  apiBaseUrl,
  unitId,
  taxYear,
  employeeId,
  durationMs,
  operationCounters,
  recordSnapshot,
}) => {
  const deadline = Date.now() + durationMs;
  const samples = [];

  while (Date.now() < deadline) {
    const progress = 1 - Math.max(0, deadline - Date.now()) / durationMs;
    const repeat = 1 + Math.floor(progress * 4);
    for (let index = 0; index < repeat; index += 1) {
      const queryMetrics = await collectQueryMetrics(apiBaseUrl, unitId, taxYear, employeeId);
      operationCounters.confirmedResultsQuery += 1;
      operationCounters.confirmedResultDetailQuery += 1;
      operationCounters.historyQuery += 1;
      samples.push({
        repeat,
        capturedAt: new Date().toISOString(),
        ...queryMetrics,
      });
      await recordSnapshot();
    }

    await sleep(500);
  }

  return {
    sampleCount: samples.length,
    peakConfirmedResultsMs: Math.max(
      0,
      ...samples.map((sample) => sample.latenciesMs.confirmedResults),
    ),
    peakHistoryResultsMs: Math.max(
      0,
      ...samples.map((sample) => sample.latenciesMs.historyResults),
    ),
    lastSample: samples.at(-1) ?? null,
  };
};

const runSteadyStatePhase = async ({
  apiBaseUrl,
  unitId,
  taxYear,
  employeeId,
  employeeCsvText,
  monthRecordCsvText,
  durationMs,
  operationCounters,
  recordSnapshot,
}) => {
  const deadline = Date.now() + durationMs;
  let cycles = 0;

  while (Date.now() < deadline) {
    await requestJson(apiBaseUrl, "/api/import/preview", {
      method: "POST",
      body: JSON.stringify({
        importType: "employee",
        unitId,
        csvText: employeeCsvText,
      }),
    });
    operationCounters.employeePreview += 1;

    await requestJson(apiBaseUrl, "/api/import/preview", {
      method: "POST",
      body: JSON.stringify({
        importType: "month_record",
        unitId,
        scopeTaxYear: taxYear,
        csvText: monthRecordCsvText,
      }),
    });
    operationCounters.monthPreview += 1;

    await requestJson(apiBaseUrl, "/api/import/commit", {
      method: "POST",
      body: JSON.stringify({
        importType: "month_record",
        unitId,
        scopeTaxYear: taxYear,
        csvText: monthRecordCsvText,
        conflictStrategy: "overwrite",
      }),
    });
    operationCounters.monthCommit += 1;

    await requestJson(
      apiBaseUrl,
      `/api/units/${unitId}/years/${taxYear}/calculation-statuses/recalculate`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    operationCounters.recalculate += 1;

    await requestJson(apiBaseUrl, `/api/units/${unitId}/years/${taxYear}/month-confirmations`);
    operationCounters.confirmationStateQuery += 1;

    await collectQueryMetrics(apiBaseUrl, unitId, taxYear, employeeId);
    operationCounters.confirmedResultsQuery += 1;
    operationCounters.confirmedResultDetailQuery += 1;
    operationCounters.historyQuery += 1;

    cycles += 1;
    await recordSnapshot();
  }

  return {
    cycles,
  };
};

const runRecoveryPhase = async ({
  apiBaseUrl,
  unitId,
  taxYear,
  employeeId,
  durationMs,
  operationCounters,
  recordSnapshot,
}) => {
  const beforeStats = collectDbStats(recordSnapshot.dbPath);
  const deadline = Date.now() + durationMs;
  let retrySuccessCount = 0;
  let retryFailureCount = 0;

  while (Date.now() < deadline) {
    try {
      await requestJsonWithRetry(
        apiBaseUrl,
        `/api/units/${unitId}/years/${taxYear}/calculation-statuses/recalculate`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      operationCounters.recalculate += 1;
      retrySuccessCount += 1;

      await requestJsonWithRetry(
        apiBaseUrl,
        `/api/units/${unitId}/years/${taxYear}/confirmed-results`,
      );
      operationCounters.confirmedResultsQuery += 1;

      await requestJsonWithRetry(
        apiBaseUrl,
        `/api/units/${unitId}/years/${taxYear}/confirmed-results/${employeeId}`,
      );
      operationCounters.confirmedResultDetailQuery += 1;

      await requestJsonWithRetry(
        apiBaseUrl,
        `/api/history-results?unitId=${unitId}&taxYear=${taxYear}&resultStatus=all`,
      );
      operationCounters.historyQuery += 1;
    } catch (error) {
      retryFailureCount += 1;
    }

    await recordSnapshot();
    await sleep(1_000);
  }

  const afterStats = collectDbStats(recordSnapshot.dbPath);
  const postRecoveryQueries = await collectQueryMetrics(apiBaseUrl, unitId, taxYear, employeeId);

  return {
    retrySuccessCount,
    retryFailureCount,
    beforeStats,
    afterStats,
    postRecoveryQueries,
  };
};

const buildFindings = ({ baseline, burst, recovery, finalDbStats, seedEmployees }) => {
  const findings = [];
  const baselineConfirmedLatency = baseline.metrics.queryMetrics.latenciesMs.confirmedResults;
  const recoveryConfirmedLatency =
    recovery.postRecoveryQueries.latenciesMs.confirmedResults;

  if (baselineConfirmedLatency > 1_500) {
    findings.push({
      priority: "P1",
      title: "基线 confirmed-results 延迟超阈值",
      detail: `基线 confirmed-results=${baselineConfirmedLatency}ms，超过 1500ms 阈值。`,
    });
  }

  if (recoveryConfirmedLatency > 2_000) {
    findings.push({
      priority: "P1",
      title: "恢复后 confirmed-results 延迟超阈值",
      detail: `恢复后 confirmed-results=${recoveryConfirmedLatency}ms，超过 2000ms 阈值。`,
    });
  }

  if (burst.afterStats.annualResultVersionCount > seedEmployees) {
    findings.push({
      priority: "P0",
      title: "无变更重算仍追加版本历史",
      detail: `重算 burst 后 versionCount=${burst.afterStats.annualResultVersionCount}，超过预期基线 ${seedEmployees}。`,
    });
  }

  if (burst.dbGrowthRate > 10) {
    findings.push({
      priority: "P1",
      title: "无变更重算阶段数据库增长超阈值",
      detail: `重算 burst 阶段数据库增长 ${burst.dbGrowthRate}% ，超过 10% 阈值。`,
    });
  }

  if (recovery.afterStats.annualResultVersionCount > burst.afterStats.annualResultVersionCount) {
    findings.push({
      priority: "P1",
      title: "恢复阶段出现额外版本放大",
      detail: `恢复前 versionCount=${burst.afterStats.annualResultVersionCount}，恢复后 versionCount=${recovery.afterStats.annualResultVersionCount}。`,
    });
  }

  if (recovery.afterStats.annualResultCount !== finalDbStats.annualResultCount) {
    findings.push({
      priority: "P1",
      title: "恢复后年度结果数量漂移",
      detail: `恢复阶段 annualResultCount=${recovery.afterStats.annualResultCount}，结束时 annualResultCount=${finalDbStats.annualResultCount}。`,
    });
  }

  return findings;
};

const runCli = async (argv) => {
  const args = parseArgs(argv);
  await ensureDirectory(args.outputDir);
  const operationCounters = {
    employeePreview: 0,
    monthPreview: 0,
    monthCommit: 0,
    recalculate: 0,
    confirmationStateQuery: 0,
    confirmedResultsQuery: 0,
    confirmedResultDetailQuery: 0,
    historyQuery: 0,
  };
  const stateRef = { currentPhase: "baseline" };
  const recordSnapshot = await createMetricsRecorder(
    args.outputDir,
    args.dbPath,
    operationCounters,
    stateRef,
  );
  recordSnapshot.dbPath = args.dbPath;

  await requestJson(args.apiBaseUrl, "/api/health");

  const totalDurationMs = args.durationMinutes * 60_000;
  const phaseDurations = Object.fromEntries(
    PHASE_DEFINITIONS.map((phase) => [
      phase.key,
      Math.max(1_000, Math.round((totalDurationMs * phase.weight) / 60)),
    ]),
  );

  const baseline = await runBaselinePhase({
    apiBaseUrl: args.apiBaseUrl,
    outputDir: args.outputDir,
    seedEmployees: args.seedEmployees,
    taxYear: args.taxYear,
    unitName: args.unitName,
  });
  const baselinePaddingMs = Math.max(0, phaseDurations.baseline - baseline.metrics.durationMs);
  if (baselinePaddingMs > 0) {
    const baselinePaddingDeadline = Date.now() + baselinePaddingMs;
    stateRef.currentPhase = "baseline";
    while (Date.now() < baselinePaddingDeadline) {
      await recordSnapshot();
      await sleep(Math.min(1_000, baselinePaddingMs));
    }
  }
  baseline.metrics.windowMs = phaseDurations.baseline;
  baseline.metrics.idlePaddingMs = Number(baselinePaddingMs.toFixed(2));
  stateRef.currentPhase = "baseline";
  await recordSnapshot(true);

  stateRef.currentPhase = "burst";
  const burst = await runBurstPhase({
    apiBaseUrl: args.apiBaseUrl,
    unitId: baseline.unit.id,
    taxYear: args.taxYear,
    durationMs: phaseDurations.burst,
    operationCounters,
    recordSnapshot,
  });
  await recordSnapshot(true);

  stateRef.currentPhase = "queryRamp";
  const queryRamp = await runQueryRampPhase({
    apiBaseUrl: args.apiBaseUrl,
    unitId: baseline.unit.id,
    taxYear: args.taxYear,
    employeeId: baseline.employeeIds[0],
    durationMs: phaseDurations.queryRamp,
    operationCounters,
    recordSnapshot,
  });
  await recordSnapshot(true);

  stateRef.currentPhase = "steadyState";
  const steadyState = await runSteadyStatePhase({
    apiBaseUrl: args.apiBaseUrl,
    unitId: baseline.unit.id,
    taxYear: args.taxYear,
    employeeId: baseline.employeeIds[0],
    employeeCsvText: baseline.employeeCsvText,
    monthRecordCsvText: baseline.monthRecordCsvText,
    durationMs: phaseDurations.steadyState,
    operationCounters,
    recordSnapshot,
  });
  await recordSnapshot(true);

  stateRef.currentPhase = "recovery";
  const recovery = await runRecoveryPhase({
    apiBaseUrl: args.apiBaseUrl,
    unitId: baseline.unit.id,
    taxYear: args.taxYear,
    employeeId: baseline.employeeIds[0],
    durationMs: phaseDurations.recovery,
    operationCounters,
    recordSnapshot,
  });
  await recordSnapshot(true);

  const finalDbStats = collectDbStats(args.dbPath);
  const findings = buildFindings({
    baseline,
    burst,
    recovery,
    finalDbStats,
    seedEmployees: args.seedEmployees,
  });

  const summary = {
    status: findings.length ? "warning" : "success",
    data: {
      args,
      unitId: baseline.unit.id,
      employeeCount: baseline.employeeIds.length,
      phaseMetrics: {
        baseline: baseline.metrics,
        burst,
        queryRamp,
        steadyState,
        recovery,
      },
      dbStats: finalDbStats,
      operationCounters,
      findings,
    },
    error: null,
  };

  await writeJsonFile(path.join(args.outputDir, "summary.json"), summary);
  return summary;
};

const main = async () => {
  try {
    const result = await runCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const failure = {
      status: "error",
      data: null,
      error: error instanceof Error ? error.message : "未知错误",
    };
    process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { parseArgs, runCli };
