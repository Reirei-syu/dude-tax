import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  CreateUnitBackupPayload,
  CreateUnitBackupResponse,
  UnitBackupDraftResponse,
  UnitBackupManifest,
  UnitBackupSummaryCounts,
} from "@dude-tax/core";
import { database } from "../db/database.js";
import { unitRepository } from "../repositories/unit-repository.js";

const execFileAsync = promisify(execFile);
const BACKUP_LAST_DIRECTORY_KEY = "backup_last_directory";
const APP_VERSION = "v0.1.0-alpha";

type BackupArchiveExecutor = (input: {
  sourceFilePath: string;
  destinationZipPath: string;
}) => Promise<void>;

type UnitBackupServiceOptions = {
  archiveExecutor?: BackupArchiveExecutor;
};

type TableSnapshot = UnitBackupManifest["data"];

type BackupErrorOptions = {
  message: string;
  statusCode: number;
};

class UnitBackupError extends Error {
  statusCode: number;

  constructor(options: BackupErrorOptions) {
    super(options.message);
    this.name = "UnitBackupError";
    this.statusCode = options.statusCode;
  }
}

const toPowerShellLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

const defaultArchiveExecutor: BackupArchiveExecutor = async ({
  sourceFilePath,
  destinationZipPath,
}) => {
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Compress-Archive -LiteralPath ${toPowerShellLiteral(sourceFilePath)} -DestinationPath ${toPowerShellLiteral(destinationZipPath)} -Force`,
  ]);
};

const getPreference = (key: string): string | null => {
  const row = database.prepare("SELECT value FROM app_preferences WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
};

const setPreference = (key: string, value: string) => {
  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
    )
    .run(key, value);
};

const getExistingDirectoryOrNull = (inputPath: string | null) => {
  if (!inputPath) {
    return null;
  }

  try {
    const resolvedPath = path.resolve(inputPath);
    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
      return null;
    }

    return resolvedPath;
  } catch {
    return null;
  }
};

const sanitizeFileNameSegment = (value: string) =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim() || "未命名单位";

const formatTimestampForFileName = (date: Date) => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${minute}${second}`;
};

const buildSuggestedFileName = (unitName: string, date = new Date()) =>
  `${sanitizeFileNameSegment(unitName)}_${formatTimestampForFileName(date)}.zip`;

const selectRows = (sql: string, ...params: unknown[]) =>
  database.prepare(sql).all(...params) as Record<string, unknown>[];

const getRelatedTaxPolicyVersions = (snapshot: TableSnapshot) => {
  const versionIds = new Set<number>();
  const policySignatures = new Set<string>();

  snapshot.taxPolicyScopes.forEach((row) => {
    const versionId = Number(row.tax_policy_version_id);
    if (Number.isInteger(versionId) && versionId > 0) {
      versionIds.add(versionId);
    }
  });

  [
    ...snapshot.annualCalculationRuns,
    ...snapshot.annualTaxResults,
    ...snapshot.annualTaxResultVersions,
  ].forEach((row) => {
    const signature = String(row.policy_signature ?? "").trim();
    if (signature) {
      policySignatures.add(signature);
    }
  });

  if (!versionIds.size && !policySignatures.size) {
    return [] as Record<string, unknown>[];
  }

  const clauses: string[] = [];
  const params: Array<number | string> = [];

  if (versionIds.size) {
    clauses.push(`id IN (${Array.from({ length: versionIds.size }, () => "?").join(", ")})`);
    params.push(...versionIds);
  }

  if (policySignatures.size) {
    clauses.push(
      `policy_signature IN (${Array.from({ length: policySignatures.size }, () => "?").join(", ")})`,
    );
    params.push(...policySignatures);
  }

  return selectRows(
    `
      SELECT *
      FROM tax_policy_versions
      WHERE ${clauses.join(" OR ")}
      ORDER BY id ASC
    `,
    ...params,
  );
};

const buildSnapshot = (unitId: number): TableSnapshot => {
  const units = selectRows("SELECT * FROM units WHERE id = ?", unitId);
  const unitYears = selectRows(
    `
      SELECT *
      FROM unit_years
      WHERE unit_id = ?
      ORDER BY tax_year ASC, id ASC
    `,
    unitId,
  );
  const employees = selectRows(
    `
      SELECT *
      FROM employees
      WHERE unit_id = ?
      ORDER BY id ASC
    `,
    unitId,
  );
  const employeeMonthRecords = selectRows(
    `
      SELECT *
      FROM employee_month_records
      WHERE unit_id = ?
      ORDER BY tax_year ASC, tax_month ASC, employee_id ASC, id ASC
    `,
    unitId,
  );
  const monthConfirmations = selectRows(
    `
      SELECT *
      FROM month_confirmations
      WHERE unit_id = ?
      ORDER BY tax_year ASC, tax_month ASC, id ASC
    `,
    unitId,
  );
  const annualCalculationRuns = selectRows(
    `
      SELECT *
      FROM annual_calculation_runs
      WHERE unit_id = ?
      ORDER BY tax_year ASC, employee_id ASC, id ASC
    `,
    unitId,
  );
  const annualTaxResults = selectRows(
    `
      SELECT *
      FROM annual_tax_results
      WHERE unit_id = ?
      ORDER BY tax_year ASC, employee_id ASC, id ASC
    `,
    unitId,
  );
  const annualTaxResultVersions = selectRows(
    `
      SELECT *
      FROM annual_tax_result_versions
      WHERE unit_id = ?
      ORDER BY tax_year ASC, employee_id ASC, version_sequence ASC, id ASC
    `,
    unitId,
  );
  const taxPolicyScopes = selectRows(
    `
      SELECT *
      FROM tax_policy_scopes
      WHERE unit_id = ?
      ORDER BY tax_year ASC, id ASC
    `,
    unitId,
  );
  const taxPolicyAuditLogs = selectRows(
    `
      SELECT *
      FROM tax_policy_audit_logs
      WHERE unit_id = ?
      ORDER BY created_at ASC, id ASC
    `,
    unitId,
  );

  return {
    units,
    unitYears,
    employees,
    employeeMonthRecords,
    monthConfirmations,
    annualCalculationRuns,
    annualTaxResults,
    annualTaxResultVersions,
    taxPolicyScopes,
    taxPolicyVersions: [],
    taxPolicyAuditLogs,
  };
};

const buildSummaryCounts = (snapshot: TableSnapshot): UnitBackupSummaryCounts => ({
  units: snapshot.units.length,
  unitYears: snapshot.unitYears.length,
  employees: snapshot.employees.length,
  employeeMonthRecords: snapshot.employeeMonthRecords.length,
  monthConfirmations: snapshot.monthConfirmations.length,
  annualCalculationRuns: snapshot.annualCalculationRuns.length,
  annualTaxResults: snapshot.annualTaxResults.length,
  annualTaxResultVersions: snapshot.annualTaxResultVersions.length,
  taxPolicyScopes: snapshot.taxPolicyScopes.length,
  taxPolicyVersions: snapshot.taxPolicyVersions.length,
  taxPolicyAuditLogs: snapshot.taxPolicyAuditLogs.length,
});

const validateTargetPath = (targetPath: string) => {
  const trimmedPath = targetPath.trim();
  if (!trimmedPath) {
    throw new UnitBackupError({
      message: "备份文件路径不能为空",
      statusCode: 400,
    });
  }

  if (!path.isAbsolute(trimmedPath)) {
    throw new UnitBackupError({
      message: "备份文件路径必须是绝对路径",
      statusCode: 400,
    });
  }

  const resolvedPath = path.resolve(trimmedPath);

  if (path.extname(resolvedPath).toLowerCase() !== ".zip") {
    throw new UnitBackupError({
      message: "备份文件必须使用 .zip 扩展名",
      statusCode: 400,
    });
  }

  const targetDirectory = path.dirname(resolvedPath);
  if (!fs.existsSync(targetDirectory) || !fs.statSync(targetDirectory).isDirectory()) {
    throw new UnitBackupError({
      message: "备份目录不存在，请重新选择有效路径",
      statusCode: 400,
    });
  }

  return {
    resolvedPath,
    targetDirectory,
  };
};

export const createUnitBackupService = (options: UnitBackupServiceOptions = {}) => {
  const archiveExecutor = options.archiveExecutor ?? defaultArchiveExecutor;

  return {
    getDraft(unitId: number): UnitBackupDraftResponse | null {
      const unit = unitRepository.getById(unitId);
      if (!unit) {
        return null;
      }

      return {
        unitId: unit.id,
        unitName: unit.unitName,
        includedTaxYears: [...unit.availableTaxYears],
        lastDirectoryPath: getExistingDirectoryOrNull(getPreference(BACKUP_LAST_DIRECTORY_KEY)),
        suggestedFileName: buildSuggestedFileName(unit.unitName),
      };
    },

    async createBackup(
      unitId: number,
      payload: CreateUnitBackupPayload,
    ): Promise<CreateUnitBackupResponse> {
      const unit = unitRepository.getById(unitId);
      if (!unit) {
        throw new UnitBackupError({
          message: "目标单位不存在",
          statusCode: 404,
        });
      }

      const { resolvedPath, targetDirectory } = validateTargetPath(payload.targetPath);
      const exportedAt = new Date().toISOString();
      const tempDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), "dude-tax-backup-"));
      const manifestPath = path.join(tempDirectory, "backup.json");

      try {
        const snapshot = buildSnapshot(unitId);
        snapshot.taxPolicyVersions = getRelatedTaxPolicyVersions(snapshot);

        const manifest: UnitBackupManifest = {
          schemaVersion: 1,
          exportedAt,
          appVersion: APP_VERSION,
          unitId: unit.id,
          unitName: unit.unitName,
          includedTaxYears: [...unit.availableTaxYears],
          scopeDescription:
            "当前备份仅包含目标单位下全部年份业务数据，以及该单位引用到的税率版本与审计记录；不包含其他单位数据、应用偏好和恢复逻辑。",
          summaryCounts: buildSummaryCounts(snapshot),
          data: snapshot,
        };

        await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

        try {
          await archiveExecutor({
            sourceFilePath: manifestPath,
            destinationZipPath: resolvedPath,
          });
        } catch (error) {
          throw new UnitBackupError({
            message:
              error instanceof Error && error.message
                ? `生成备份压缩包失败：${error.message}`
                : "生成备份压缩包失败",
            statusCode: 500,
          });
        }

        setPreference(BACKUP_LAST_DIRECTORY_KEY, targetDirectory);

        return {
          status: "success",
          filePath: resolvedPath,
          exportedAt,
          summaryCounts: manifest.summaryCounts,
        };
      } finally {
        await fsp.rm(tempDirectory, { recursive: true, force: true });
      }
    },
  };
};

export const unitBackupService = createUnitBackupService();
export { UnitBackupError, buildSuggestedFileName };
