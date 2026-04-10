import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  type UpsertEmployeeMonthRecordPayload,
} from "@dude-tax/core";

const execFileAsync = promisify(execFile);
const testDatabasePath = path.join(process.cwd(), "data", "test", "unit-backup.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/units.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./repositories/month-record-repository.js"),
  import("./services/unit-backup-service.js"),
  import("./db/database.js"),
]);

const createMonthRecordPayload = (
  overrides: Partial<UpsertEmployeeMonthRecordPayload> = {},
): UpsertEmployeeMonthRecordPayload => ({
  status: "completed",
  salaryIncome: 10_000,
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
  remark: "",
  ...overrides,
});

const seedTaxPolicyVersion = (
  database: Awaited<(typeof modulesPromise)>[5]["database"],
  input: {
    versionName: string;
    settings?: ReturnType<typeof buildDefaultTaxPolicySettings>;
    isActive?: boolean;
  },
) => {
  const settings = input.settings ?? buildDefaultTaxPolicySettings();
  const now = new Date().toISOString();
  const result = database
    .prepare(
      `
        INSERT INTO tax_policy_versions (
          version_name,
          policy_signature,
          settings_json,
          maintenance_notes,
          is_active,
          created_at,
          activated_at,
          updated_at
        )
        VALUES (?, ?, ?, '', ?, ?, ?, ?)
      `,
    )
    .run(
      input.versionName,
      buildTaxPolicySignature(settings),
      JSON.stringify(settings),
      input.isActive ? 1 : 0,
      now,
      input.isActive ? now : null,
      now,
    );

  return {
    id: Number(result.lastInsertRowid),
    policySignature: buildTaxPolicySignature(settings),
  };
};

const expandZipArchive = async (zipPath: string, destinationPath: string) => {
  fs.mkdirSync(destinationPath, { recursive: true });
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`,
  ]);
};

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , , , { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM tax_policy_audit_logs;
    DELETE FROM tax_policy_scopes;
    DELETE FROM annual_tax_result_versions;
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM month_confirmations;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM unit_years;
    DELETE FROM units;
    DELETE FROM tax_policy_versions;
    DELETE FROM app_preferences;
  `);

  const activeVersion = seedTaxPolicyVersion(database, {
    versionName: "初始税率版本",
    isActive: true,
  });
  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
      `,
    )
    .run("active_tax_policy_version_id", String(activeVersion.id));
});

after(async () => {
  const [, , , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("单位备份草稿接口返回建议文件名、年份范围与最近目录", async () => {
  const [{ registerUnitRoutes }, { unitRepository }, , , , { database }] = await modulesPromise;

  const rememberedDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dude-tax-backup-dir-"));
  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
      `,
    )
    .run("backup_last_directory", rememberedDirectory);

  const unit = unitRepository.create({
    unitName: "测试:/单位",
    remark: "",
    startYear: 2026,
  });
  unitRepository.addYear(unit.id, 2028);

  const app = Fastify({ logger: false });
  await registerUnitRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/backup-draft`,
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.unitId, unit.id);
  assert.equal(body.unitName, "测试:/单位");
  assert.deepEqual(body.includedTaxYears, [2026, 2028]);
  assert.equal(body.lastDirectoryPath, rememberedDirectory);
  assert.match(String(body.suggestedFileName), /^测试__单位_\d{8}_\d{6}\.zip$/);

  await app.close();
  fs.rmSync(rememberedDirectory, { recursive: true, force: true });
});

test("单位备份接口生成 ZIP 且只包含目标单位及关联税率版本数据", async () => {
  const [
    { registerUnitRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    ,
    { database },
  ] = await modulesPromise;

  const scopedSettings = buildDefaultTaxPolicySettings();
  scopedSettings.basicDeductionAmount = 7_000;
  const scopedVersion = seedTaxPolicyVersion(database, {
    versionName: "单位 A 专属版本",
    settings: scopedSettings,
  });
  const unusedSettings = buildDefaultTaxPolicySettings();
  unusedSettings.basicDeductionAmount = 9_000;
  const unusedVersion = seedTaxPolicyVersion(database, {
    versionName: "未使用版本",
    settings: unusedSettings,
  });

  const unitA = unitRepository.create({
    unitName: "单位A",
    remark: "",
    startYear: 2026,
  });
  unitRepository.addYear(unitA.id, 2027);
  const unitB = unitRepository.create({
    unitName: "单位B",
    remark: "",
    startYear: 2026,
  });

  const employeeA = employeeRepository.create(unitA.id, {
    employeeCode: "EMP-A-001",
    employeeName: "员工A",
    idNumber: "110101199001011111",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  const employeeB = employeeRepository.create(unitB.id, {
    employeeCode: "EMP-B-001",
    employeeName: "员工B",
    idNumber: "110101199001022222",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  monthRecordRepository.upsert(
    unitA.id,
    employeeA.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 12_345, withheldTax: 321 }),
  );
  monthRecordRepository.upsert(
    unitB.id,
    employeeB.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 54_321, withheldTax: 123 }),
  );

  const now = new Date().toISOString();
  database
    .prepare(
      `
        INSERT INTO month_confirmations (unit_id, tax_year, tax_month, confirmed_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(unitA.id, 2026, 1, now, now);
  database
    .prepare(
      `
        INSERT INTO annual_calculation_runs (
          unit_id,
          employee_id,
          tax_year,
          last_status,
          policy_signature,
          data_signature,
          last_calculated_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(unitA.id, employeeA.id, 2026, "ready", scopedVersion.policySignature, "run-signature-a", now, now);
  database
    .prepare(
      `
        INSERT INTO annual_tax_results (
          unit_id,
          employee_id,
          tax_year,
          selected_scheme,
          selected_tax_amount,
          policy_signature,
          data_signature,
          calculation_snapshot,
          calculated_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      unitA.id,
      employeeA.id,
      2026,
      "combined_bonus",
      456,
      scopedVersion.policySignature,
      "result-signature-a",
      JSON.stringify({ result: "unit-a" }),
      now,
      now,
    );
  database
    .prepare(
      `
        INSERT INTO annual_tax_result_versions (
          unit_id,
          employee_id,
          tax_year,
          version_sequence,
          policy_signature,
          data_signature,
          selected_scheme,
          selected_tax_amount,
          calculation_snapshot,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      unitA.id,
      employeeA.id,
      2026,
      1,
      scopedVersion.policySignature,
      "history-signature-a",
      "combined_bonus",
      456,
      JSON.stringify({ history: "unit-a" }),
      now,
    );
  database
    .prepare(
      `
        INSERT INTO tax_policy_scopes (
          scope_type,
          unit_id,
          tax_year,
          tax_policy_version_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run("unit_year", unitA.id, 2026, scopedVersion.id, now, now);
  database
    .prepare(
      `
        INSERT INTO tax_policy_audit_logs (
          action_type,
          actor_label,
          tax_policy_version_id,
          unit_id,
          tax_year,
          summary,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run("bind_scope", "本地用户", scopedVersion.id, unitA.id, 2026, "单位 A 绑定专属税率", now);
  database
    .prepare(
      `
        INSERT INTO tax_policy_audit_logs (
          action_type,
          actor_label,
          tax_policy_version_id,
          unit_id,
          tax_year,
          summary,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run("bind_scope", "本地用户", unusedVersion.id, unitB.id, 2026, "单位 B 绑定其他税率", now);

  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dude-tax-backup-output-"));
  const zipPath = path.join(outputDirectory, "单位A备份.zip");
  const extractDirectory = path.join(outputDirectory, "unzipped");

  const app = Fastify({ logger: false });
  await registerUnitRoutes(app);

  const response = await app.inject({
    method: "POST",
    url: `/api/units/${unitA.id}/backup`,
    payload: {
      targetPath: zipPath,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.status, "success");
  assert.equal(body.filePath, zipPath);
  assert.equal(typeof body.exportedAt, "string");

  await expandZipArchive(zipPath, extractDirectory);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(extractDirectory, "backup.json"), "utf8"),
  ) as Record<string, unknown>;

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.unitName, "单位A");
  assert.deepEqual(manifest.includedTaxYears, [2026, 2027]);
  assert.equal(typeof manifest.exportedAt, "string");
  assert.equal(typeof manifest.scopeDescription, "string");

  const data = manifest.data as Record<string, Array<Record<string, unknown>>>;
  assert.deepEqual(data.units.map((row) => row.id), [unitA.id]);
  assert.deepEqual(data.employees.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(data.employeeMonthRecords.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(data.monthConfirmations.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(data.annualCalculationRuns.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(data.annualTaxResults.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(data.annualTaxResultVersions.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(data.taxPolicyScopes.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(data.taxPolicyAuditLogs.map((row) => row.unit_id), [unitA.id]);
  assert.deepEqual(
    data.taxPolicyVersions.map((row) => row.id).sort((left, right) => Number(left) - Number(right)),
    [scopedVersion.id],
  );

  const summaryCounts = manifest.summaryCounts as Record<string, number>;
  assert.equal(summaryCounts.units, 1);
  assert.equal(summaryCounts.employees, 1);
  assert.equal(summaryCounts.taxPolicyVersions, 1);

  const rememberedDirectory = (
    database
      .prepare("SELECT value FROM app_preferences WHERE key = ?")
      .get("backup_last_directory") as { value: string } | undefined
  )?.value;
  assert.equal(rememberedDirectory, outputDirectory);

  await app.close();
  fs.rmSync(outputDirectory, { recursive: true, force: true });
});

test("单位备份服务在压缩失败时返回结构化错误", async () => {
  const [, { unitRepository }, , , { createUnitBackupService }, { database }] = await modulesPromise;

  const unit = unitRepository.create({
    unitName: "压缩失败测试单位",
    remark: "",
    startYear: 2026,
  });

  const service = createUnitBackupService({
    archiveExecutor: async () => {
      throw new Error("archive failed");
    },
  });

  await assert.rejects(
    service.createBackup(unit.id, {
      targetPath: path.join(os.tmpdir(), "unit-backup-service-failure.zip"),
    }),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as Error & { statusCode?: number }).statusCode, 500);
      assert.match((error as Error).message, /生成备份压缩包失败/);
      const rememberedDirectory = (
        database
          .prepare("SELECT value FROM app_preferences WHERE key = ?")
          .get("backup_last_directory") as { value: string } | undefined
      )?.value;
      assert.equal(rememberedDirectory, undefined);
      return true;
    },
  );
});

test("单位备份接口会拒绝相对路径", async () => {
  const [{ registerUnitRoutes }, { unitRepository }] = await modulesPromise;

  const unit = unitRepository.create({
    unitName: "相对路径测试单位",
    remark: "",
    startYear: 2026,
  });

  const app = Fastify({ logger: false });
  await registerUnitRoutes(app);

  const response = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/backup`,
    payload: {
      targetPath: "relative-backup.zip",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json() as Record<string, unknown>;
  assert.match(String(body.message), /绝对路径/);

  await app.close();
});
