import {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  isSameTaxPolicySettings,
  normalizeTaxPolicySettings,
  type TaxPolicyAuditAction,
  type TaxPolicyAuditLog,
  type TaxPolicyBindScopePayload,
  type TaxPolicyContent,
  type TaxPolicyResponse,
  type TaxPolicySaveResponse,
  type TaxPolicyScopeBindingSummary,
  type TaxPolicySettings,
  type TaxPolicySettingsInput,
  type TaxPolicyUpdatePayload,
  type TaxPolicyVersionDiffItem,
  type TaxPolicyVersionImpactPreview,
  type TaxPolicyVersionSummary,
} from "@dude-tax/core";
import { database } from "../db/database.js";

const ACTIVE_TAX_POLICY_VERSION_ID_KEY = "active_tax_policy_version_id";
const DEFAULT_TAX_POLICY_VERSION_NAME = "默认税率版本";
const DEFAULT_AUDIT_ACTOR_LABEL = "本地用户";
const DEFAULT_AUDIT_LIMIT = 20;
const SCOPE_TYPE_UNIT_YEAR = "unit_year";
const DEFAULT_POLICY_CONTENT: TaxPolicyContent = {
  policyTitle: "",
  policyBody: "",
  policyIllustrationDataUrl: "",
};

type TaxPolicyVersionRow = {
  id: number;
  version_name: string;
  policy_signature: string;
  settings_json: string;
  maintenance_notes: string;
  is_active: number;
  created_at: string;
  activated_at: string | null;
  updated_at: string;
};

type TaxPolicyScopeBindingRow = {
  tax_policy_version_id: number;
  version_name: string;
  policy_signature: string;
};

type TaxPolicyAuditLogRow = {
  id: number;
  action_type: TaxPolicyAuditAction;
  actor_label: string;
  tax_policy_version_id: number | null;
  unit_id: number | null;
  tax_year: number | null;
  summary: string;
  created_at: string;
  version_name: string | null;
};

const getPreference = (key: string): string | null => {
  const row = database
    .prepare("SELECT value FROM app_preferences WHERE key = ?")
    .get(key) as { value: string } | undefined;

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

const parseSettingsJson = (settingsJson: string) =>
  normalizeTaxPolicySettings(JSON.parse(settingsJson) as TaxPolicySettingsInput);

const parsePolicyContent = (rawValue: string | null | undefined): TaxPolicyContent => {
  const normalized = rawValue?.trim() ?? "";
  if (!normalized) {
    return { ...DEFAULT_POLICY_CONTENT };
  }

  if (normalized.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalized) as Partial<TaxPolicyContent>;
      return {
        policyTitle: String(parsed.policyTitle ?? "").trim(),
        policyBody: String(parsed.policyBody ?? "").trim(),
        policyIllustrationDataUrl: String(parsed.policyIllustrationDataUrl ?? "").trim(),
      };
    } catch {
      return {
        ...DEFAULT_POLICY_CONTENT,
        policyBody: normalized,
      };
    }
  }

  return {
    ...DEFAULT_POLICY_CONTENT,
    policyBody: normalized,
  };
};

const serializePolicyContent = (content: TaxPolicyContent) =>
  JSON.stringify({
    policyTitle: content.policyTitle.trim(),
    policyBody: content.policyBody.trim(),
    policyIllustrationDataUrl: content.policyIllustrationDataUrl.trim(),
  });

const getVersionRows = (): TaxPolicyVersionRow[] =>
  database
    .prepare(
      `
        SELECT
          id,
          version_name,
          policy_signature,
          settings_json,
          maintenance_notes,
          is_active,
          created_at,
          activated_at,
          updated_at
        FROM tax_policy_versions
        ORDER BY created_at DESC, id DESC
      `,
    )
    .all() as TaxPolicyVersionRow[];

const getVersionRowById = (versionId: number): TaxPolicyVersionRow | null =>
  ((database
    .prepare(
      `
        SELECT
          id,
          version_name,
          policy_signature,
          settings_json,
          maintenance_notes,
          is_active,
          created_at,
          activated_at,
          updated_at
        FROM tax_policy_versions
        WHERE id = ?
      `,
    )
    .get(versionId) as TaxPolicyVersionRow | undefined) ?? null);

const getActiveVersionRow = (): TaxPolicyVersionRow | null => {
  const preferredActiveId = Number(getPreference(ACTIVE_TAX_POLICY_VERSION_ID_KEY) ?? 0);
  if (preferredActiveId > 0) {
    const preferredRow = getVersionRowById(preferredActiveId);
    if (preferredRow) {
      return preferredRow;
    }
  }

  return (
    (database
      .prepare(
        `
          SELECT
            id,
            version_name,
            policy_signature,
            settings_json,
            maintenance_notes,
            is_active,
            created_at,
            activated_at,
            updated_at
          FROM tax_policy_versions
          WHERE is_active = 1
          ORDER BY activated_at DESC, created_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get() as TaxPolicyVersionRow | undefined) ?? null
  );
};

const getScopeBindingRow = (unitId: number, taxYear: number): TaxPolicyScopeBindingRow | null =>
  ((database
    .prepare(
      `
        SELECT
          scope.tax_policy_version_id,
          version.version_name,
          version.policy_signature
        FROM tax_policy_scopes scope
        INNER JOIN tax_policy_versions version
          ON version.id = scope.tax_policy_version_id
        WHERE scope.scope_type = ?
          AND scope.unit_id = ?
          AND scope.tax_year = ?
        LIMIT 1
      `,
    )
    .get(SCOPE_TYPE_UNIT_YEAR, unitId, taxYear) as TaxPolicyScopeBindingRow | undefined) ?? null);

const getEffectiveVersionRowForScope = (unitId?: number, taxYear?: number): TaxPolicyVersionRow | null => {
  const activeVersion = getActiveVersionRow();
  if (!unitId || !taxYear || !activeVersion) {
    return activeVersion;
  }

  const scopeBinding = getScopeBindingRow(unitId, taxYear);
  if (!scopeBinding) {
    return activeVersion;
  }

  return getVersionRowById(scopeBinding.tax_policy_version_id) ?? activeVersion;
};

const mapVersionSummary = (row: TaxPolicyVersionRow): TaxPolicyVersionSummary => ({
  id: row.id,
  versionName: row.version_name,
  policySignature: row.policy_signature,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  activatedAt: row.activated_at,
});

const buildVersionName = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `税率版本 ${year}-${month}-${day} ${hours}:${minutes}`;
};

const activateVersionRecord = (versionId: number) => {
  const now = new Date().toISOString();
  const transaction = database.transaction(() => {
    database.prepare("UPDATE tax_policy_versions SET is_active = 0").run();
    database
      .prepare(
        `
          UPDATE tax_policy_versions
          SET is_active = 1,
              activated_at = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(now, now, versionId);
    setPreference(ACTIVE_TAX_POLICY_VERSION_ID_KEY, String(versionId));
  });

  transaction();
};

const buildScopeBindingSummary = (
  activeVersion: TaxPolicyVersionRow | null,
  unitId?: number,
  taxYear?: number,
): TaxPolicyScopeBindingSummary | null => {
  if (!unitId || !taxYear || !activeVersion) {
    return null;
  }

  const scopeBinding = getScopeBindingRow(unitId, taxYear);
  if (scopeBinding) {
    return {
      unitId,
      taxYear,
      versionId: scopeBinding.tax_policy_version_id,
      versionName: scopeBinding.version_name,
      policySignature: scopeBinding.policy_signature,
      isInherited: false,
    };
  }

  return {
    unitId,
    taxYear,
    versionId: activeVersion.id,
    versionName: activeVersion.version_name,
    policySignature: activeVersion.policy_signature,
    isInherited: true,
  };
};

const insertAuditLog = (input: {
  actionType: TaxPolicyAuditAction;
  versionId?: number | null;
  unitId?: number | null;
  taxYear?: number | null;
  summary: string;
}) => {
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
    .run(
      input.actionType,
      DEFAULT_AUDIT_ACTOR_LABEL,
      input.versionId ?? null,
      input.unitId ?? null,
      input.taxYear ?? null,
      input.summary,
      new Date().toISOString(),
    );
};

const listAuditLogs = (limit = DEFAULT_AUDIT_LIMIT): TaxPolicyAuditLog[] => {
  const rows = database
    .prepare(
      `
        SELECT
          log.id,
          log.action_type,
          log.actor_label,
          log.tax_policy_version_id,
          log.unit_id,
          log.tax_year,
          log.summary,
          log.created_at,
          version.version_name
        FROM tax_policy_audit_logs log
        LEFT JOIN tax_policy_versions version
          ON version.id = log.tax_policy_version_id
        ORDER BY log.created_at DESC, log.id DESC
        LIMIT ?
      `,
    )
    .all(limit) as TaxPolicyAuditLogRow[];

  return rows.map((row) => ({
    id: row.id,
    actionType: row.action_type,
    actorLabel: row.actor_label,
    versionId: row.tax_policy_version_id,
    versionName: row.version_name,
    unitId: row.unit_id,
    taxYear: row.tax_year,
    summary: row.summary,
    createdAt: row.created_at,
  }));
};

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatRangeMax = (value: number | null) => (value === null ? "不封顶" : `${formatCurrency(value)} 元`);

const buildBracketText = (
  bracket:
    | TaxPolicySettings["comprehensiveTaxBrackets"][number]
    | TaxPolicySettings["bonusTaxBrackets"][number],
  maxValue: number | null,
) => `封顶 ${formatRangeMax(maxValue)} / 税率 ${bracket.rate}% / 速算扣除 ${formatCurrency(bracket.quickDeduction)}`;

const buildVersionDiffItems = (
  baselineSettings: TaxPolicySettings,
  targetSettings: TaxPolicySettings,
): TaxPolicyVersionDiffItem[] => {
  const items: TaxPolicyVersionDiffItem[] = [];

  if (baselineSettings.basicDeductionAmount !== targetSettings.basicDeductionAmount) {
    items.push({
      label: "基本减除费用",
      baselineValue: `${formatCurrency(baselineSettings.basicDeductionAmount)} 元 / 月`,
      targetValue: `${formatCurrency(targetSettings.basicDeductionAmount)} 元 / 月`,
    });
  }

  baselineSettings.comprehensiveTaxBrackets.forEach((baselineBracket, index) => {
    const targetBracket = targetSettings.comprehensiveTaxBrackets[index];
    if (!targetBracket) {
      return;
    }

    const baselineText = buildBracketText(baselineBracket, baselineBracket.maxAnnualIncome);
    const targetText = buildBracketText(targetBracket, targetBracket.maxAnnualIncome);
    if (baselineText !== targetText) {
      items.push({
        label: `综合所得第 ${baselineBracket.level} 档`,
        baselineValue: baselineText,
        targetValue: targetText,
      });
    }
  });

  baselineSettings.bonusTaxBrackets.forEach((baselineBracket, index) => {
    const targetBracket = targetSettings.bonusTaxBrackets[index];
    if (!targetBracket) {
      return;
    }

    const baselineText = buildBracketText(
      baselineBracket,
      baselineBracket.maxAverageMonthlyIncome,
    );
    const targetText = buildBracketText(targetBracket, targetBracket.maxAverageMonthlyIncome);
    if (baselineText !== targetText) {
      items.push({
        label: `年终奖第 ${baselineBracket.level} 档`,
        baselineValue: baselineText,
        targetValue: targetText,
      });
    }
  });

  return items;
};

const countScopeRows = (
  tableName: "annual_tax_results" | "annual_calculation_runs",
  unitId: number,
  taxYear: number,
  targetPolicySignature: string,
) => {
  const total = Number(
    (
      database
        .prepare(`SELECT COUNT(*) AS total FROM ${tableName} WHERE unit_id = ? AND tax_year = ?`)
        .get(unitId, taxYear) as { total: number }
    ).total,
  );
  const invalidated = Number(
    (
      database
        .prepare(
          `
            SELECT COUNT(*) AS total
            FROM ${tableName}
            WHERE unit_id = ? AND tax_year = ? AND policy_signature <> ?
          `,
        )
        .get(unitId, taxYear, targetPolicySignature) as { total: number }
    ).total,
  );

  return {
    total,
    invalidated,
  };
};

const buildResponse = (unitId?: number, taxYear?: number): TaxPolicyResponse => {
  const defaultSettings = buildDefaultTaxPolicySettings();
  const activeVersion = getActiveVersionRow();
  const effectiveVersion = getEffectiveVersionRowForScope(unitId, taxYear);
  const currentSettings = effectiveVersion ? parseSettingsJson(effectiveVersion.settings_json) : defaultSettings;
  const currentPolicyContent = parsePolicyContent(effectiveVersion?.maintenance_notes ?? "");
  const policyCustomized = Boolean(
    currentPolicyContent.policyTitle ||
      currentPolicyContent.policyBody ||
      currentPolicyContent.policyIllustrationDataUrl,
  );

  return {
    currentSettings,
    defaultSettings,
    isCustomized: !isSameTaxPolicySettings(currentSettings, defaultSettings),
    currentVersionId: effectiveVersion?.id ?? 0,
    currentVersionName: effectiveVersion?.version_name ?? DEFAULT_TAX_POLICY_VERSION_NAME,
    versions: getVersionRows().map(mapVersionSummary),
    currentScopeBinding: buildScopeBindingSummary(activeVersion, unitId, taxYear),
    auditLogs: listAuditLogs(),
    currentNotes: currentPolicyContent.policyBody,
    defaultNotes: DEFAULT_POLICY_CONTENT.policyBody,
    notesCustomized: policyCustomized,
    policyTitle: currentPolicyContent.policyTitle,
    policyBody: currentPolicyContent.policyBody,
    policyIllustrationDataUrl: currentPolicyContent.policyIllustrationDataUrl,
    defaultPolicyTitle: DEFAULT_POLICY_CONTENT.policyTitle,
    defaultPolicyBody: DEFAULT_POLICY_CONTENT.policyBody,
    defaultPolicyIllustrationDataUrl: DEFAULT_POLICY_CONTENT.policyIllustrationDataUrl,
    policyCustomized,
  };
};

export const taxPolicyRepository = {
  get(unitId?: number, taxYear?: number): TaxPolicyResponse {
    return buildResponse(unitId, taxYear);
  },

  getCurrentPolicySignature(unitId?: number, taxYear?: number) {
    const effectiveVersion = getEffectiveVersionRowForScope(unitId, taxYear);
    return effectiveVersion?.policy_signature ?? buildTaxPolicySignature(buildDefaultTaxPolicySettings());
  },

  getEffectiveSettingsForScope(unitId?: number, taxYear?: number) {
    const effectiveVersion = getEffectiveVersionRowForScope(unitId, taxYear);
    if (!effectiveVersion) {
      return buildDefaultTaxPolicySettings();
    }

    return parseSettingsJson(effectiveVersion.settings_json);
  },

  getCurrentScopeBinding(unitId: number, taxYear: number) {
    return buildScopeBindingSummary(getActiveVersionRow(), unitId, taxYear);
  },

  previewVersionImpact(versionId: number, unitId: number, taxYear: number): TaxPolicyVersionImpactPreview | null {
    const targetVersion = getVersionRowById(versionId);
    const currentScopeBinding = buildScopeBindingSummary(getActiveVersionRow(), unitId, taxYear);
    if (!targetVersion || !currentScopeBinding) {
      return null;
    }

    const currentSettings = this.getEffectiveSettingsForScope(unitId, taxYear);
    const targetSettings = parseSettingsJson(targetVersion.settings_json);
    const affectedResults = countScopeRows(
      "annual_tax_results",
      unitId,
      taxYear,
      targetVersion.policy_signature,
    );
    const affectedRuns = countScopeRows(
      "annual_calculation_runs",
      unitId,
      taxYear,
      targetVersion.policy_signature,
    );

    return {
      unitId,
      taxYear,
      currentVersionId: currentScopeBinding.versionId,
      currentVersionName: currentScopeBinding.versionName,
      targetVersionId: targetVersion.id,
      targetVersionName: targetVersion.version_name,
      currentBindingMode: currentScopeBinding.isInherited ? "inherited" : "bound",
      targetBindingMode: "bound",
      affectedResultCount: affectedResults.total,
      invalidatedResultCount: affectedResults.invalidated,
      affectedRunCount: affectedRuns.total,
      invalidatedRunCount: affectedRuns.invalidated,
      diffItems: buildVersionDiffItems(currentSettings, targetSettings),
    };
  },

  activateVersion(versionId: number): TaxPolicySaveResponse | null {
    const targetVersion = getVersionRowById(versionId);
    if (!targetVersion) {
      return null;
    }

    const currentActiveVersion = getActiveVersionRow();
    if (currentActiveVersion?.id === versionId) {
      return {
        ...buildResponse(),
        invalidatedResults: false,
      };
    }

    activateVersionRecord(versionId);
    insertAuditLog({
      actionType: "activate_version",
      versionId,
      summary: `激活税率版本“${targetVersion.version_name}”为全局活动版本`,
    });

    return {
      ...buildResponse(),
      invalidatedResults: currentActiveVersion?.policy_signature !== targetVersion.policy_signature,
    };
  },

  bindVersionToScope(payload: TaxPolicyBindScopePayload & { versionId: number }): TaxPolicySaveResponse | null {
    const targetVersion = getVersionRowById(payload.versionId);
    if (!targetVersion) {
      return null;
    }

    const currentScopeBinding = buildScopeBindingSummary(
      getActiveVersionRow(),
      payload.unitId,
      payload.taxYear,
    );
    if (
      currentScopeBinding &&
      !currentScopeBinding.isInherited &&
      currentScopeBinding.versionId === payload.versionId
    ) {
      return {
        ...buildResponse(payload.unitId, payload.taxYear),
        invalidatedResults: false,
      };
    }

    const now = new Date().toISOString();
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
          ON CONFLICT(scope_type, unit_id, tax_year) DO UPDATE SET
            tax_policy_version_id = excluded.tax_policy_version_id,
            updated_at = excluded.updated_at
        `,
      )
      .run(
        SCOPE_TYPE_UNIT_YEAR,
        payload.unitId,
        payload.taxYear,
        payload.versionId,
        now,
        now,
      );

    insertAuditLog({
      actionType: "bind_scope",
      versionId: payload.versionId,
      unitId: payload.unitId,
      taxYear: payload.taxYear,
      summary: `将税率版本“${targetVersion.version_name}”绑定到单位 ${payload.unitId} / ${payload.taxYear} 年`,
    });

    return {
      ...buildResponse(payload.unitId, payload.taxYear),
      invalidatedResults: currentScopeBinding?.policySignature !== targetVersion.policy_signature,
    };
  },

  clearScopeBinding(unitId: number, taxYear: number): TaxPolicySaveResponse {
    const activeVersion = getActiveVersionRow();
    const currentScopeBinding = buildScopeBindingSummary(activeVersion, unitId, taxYear);
    if (!currentScopeBinding || currentScopeBinding.isInherited) {
      return {
        ...buildResponse(unitId, taxYear),
        invalidatedResults: false,
      };
    }

    database
      .prepare(
        `
          DELETE FROM tax_policy_scopes
          WHERE scope_type = ? AND unit_id = ? AND tax_year = ?
        `,
      )
      .run(SCOPE_TYPE_UNIT_YEAR, unitId, taxYear);

    insertAuditLog({
      actionType: "unbind_scope",
      versionId: activeVersion?.id ?? null,
      unitId,
      taxYear,
      summary: `解除单位 ${unitId} / ${taxYear} 年的专属税率绑定，恢复继承“${activeVersion?.version_name ?? DEFAULT_TAX_POLICY_VERSION_NAME}”`,
    });

    return {
      ...buildResponse(unitId, taxYear),
      invalidatedResults:
        currentScopeBinding.policySignature !==
        (activeVersion?.policy_signature ?? buildTaxPolicySignature(buildDefaultTaxPolicySettings())),
    };
  },

  save(payload: TaxPolicyUpdatePayload): TaxPolicySaveResponse {
    const currentResponse = buildResponse();
    const nextSettings = normalizeTaxPolicySettings(payload);
    const nextPolicyContent: TaxPolicyContent = {
      policyTitle: payload.policyTitle?.trim() ?? currentResponse.policyTitle,
      policyBody:
        payload.policyBody?.trim() ??
        payload.maintenanceNotes?.trim() ??
        currentResponse.policyBody,
      policyIllustrationDataUrl:
        payload.policyIllustrationDataUrl?.trim() ?? currentResponse.policyIllustrationDataUrl,
    };
    const nextNotes = serializePolicyContent(nextPolicyContent);
    const defaultSettings = buildDefaultTaxPolicySettings();
    const activeVersion = getActiveVersionRow();
    const settingsChanged = !isSameTaxPolicySettings(currentResponse.currentSettings, nextSettings);
    const notesChanged =
      currentResponse.policyTitle !== nextPolicyContent.policyTitle ||
      currentResponse.policyBody !== nextPolicyContent.policyBody ||
      currentResponse.policyIllustrationDataUrl !== nextPolicyContent.policyIllustrationDataUrl;

    if (!settingsChanged && !notesChanged) {
      return {
        ...currentResponse,
        invalidatedResults: false,
      };
    }

    if (!settingsChanged && notesChanged && activeVersion) {
      database
        .prepare(
          `
            UPDATE tax_policy_versions
            SET maintenance_notes = ?,
                updated_at = ?
            WHERE id = ?
          `,
        )
        .run(nextNotes, new Date().toISOString(), activeVersion.id);

      insertAuditLog({
        actionType: "update_notes",
        versionId: activeVersion.id,
        summary: `更新当前政策说明，当前版本为“${activeVersion.version_name}”`,
      });

      return {
        ...buildResponse(),
        invalidatedResults: false,
      };
    }

    const nextPolicySignature = buildTaxPolicySignature(nextSettings);
    const existingVersion = getVersionRows().find(
      (version) => version.policy_signature === nextPolicySignature,
    );

    if (existingVersion) {
      const transaction = database.transaction(() => {
        if (existingVersion.maintenance_notes !== nextNotes) {
          database
            .prepare(
              `
                UPDATE tax_policy_versions
                SET maintenance_notes = ?,
                    updated_at = ?
                WHERE id = ?
              `,
            )
            .run(nextNotes, new Date().toISOString(), existingVersion.id);
        }
        activateVersionRecord(existingVersion.id);
      });

      transaction();
      insertAuditLog({
        actionType: "save_settings",
        versionId: existingVersion.id,
        summary: `复用已有税率版本“${existingVersion.version_name}”并设为全局活动版本`,
      });

      return {
        ...buildResponse(),
        invalidatedResults: activeVersion?.policy_signature !== existingVersion.policy_signature,
      };
    }

    const now = new Date();
    const versionName = isSameTaxPolicySettings(defaultSettings, nextSettings)
      ? DEFAULT_TAX_POLICY_VERSION_NAME
      : buildVersionName(now);
    const transaction = database.transaction(() => {
      const insertResult = database
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
            VALUES (?, ?, ?, ?, 0, ?, NULL, ?)
          `,
        )
        .run(
          versionName,
          nextPolicySignature,
          JSON.stringify(nextSettings),
          nextNotes,
          now.toISOString(),
          now.toISOString(),
        );

      activateVersionRecord(Number(insertResult.lastInsertRowid));
    });

    transaction();
    const createdVersion = getVersionRows().find((version) => version.policy_signature === nextPolicySignature);
    insertAuditLog({
      actionType: "save_settings",
      versionId: createdVersion?.id ?? null,
      summary: `创建并启用税率版本“${versionName}”`,
    });

    return {
      ...buildResponse(),
      invalidatedResults: activeVersion?.policy_signature !== nextPolicySignature,
    };
  },
};
