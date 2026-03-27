import {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  isSameTaxPolicySettings,
  normalizeTaxPolicySettings,
  type TaxPolicyResponse,
  type TaxPolicySaveResponse,
  type TaxPolicyScopeBindingSummary,
  type TaxPolicyVersionSummary,
  type TaxPolicySettingsInput,
  type TaxPolicyBindScopePayload,
  type TaxPolicyUpdatePayload,
} from "../../../../packages/core/src/index.js";
import { database } from "../db/database.js";

const ACTIVE_TAX_POLICY_VERSION_ID_KEY = "active_tax_policy_version_id";
const DEFAULT_TAX_POLICY_MAINTENANCE_NOTES = "";
const SCOPE_TYPE_UNIT_YEAR = "unit_year";

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

const parseSettingsJson = (settingsJson: string) =>
  normalizeTaxPolicySettings(JSON.parse(settingsJson) as TaxPolicySettingsInput);

const getActiveVersionRow = (): TaxPolicyVersionRow | null => {
  const preferredActiveId = Number(getPreference(ACTIVE_TAX_POLICY_VERSION_ID_KEY) ?? 0);

  if (preferredActiveId > 0) {
    const preferredRow = database
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
      .get(preferredActiveId) as TaxPolicyVersionRow | undefined;

    if (preferredRow) {
      return preferredRow;
    }
  }

  const activeRow = database
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
    .get() as TaxPolicyVersionRow | undefined;

  return activeRow ?? null;
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

  const activateTransaction = database.transaction(() => {
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

  activateTransaction();
};

const getScopeBindingRow = (unitId: number, taxYear: number) =>
  database
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
    .get(SCOPE_TYPE_UNIT_YEAR, unitId, taxYear) as
    | {
        tax_policy_version_id: number;
        version_name: string;
        policy_signature: string;
      }
    | undefined;

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
      versionId: Number(scopeBinding.tax_policy_version_id),
      versionName: String(scopeBinding.version_name),
      policySignature: String(scopeBinding.policy_signature),
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

const getEffectiveVersionRowForScope = (unitId?: number, taxYear?: number) => {
  const activeVersion = getActiveVersionRow();
  if (!unitId || !taxYear || !activeVersion) {
    return activeVersion;
  }

  const scopeBinding = getScopeBindingRow(unitId, taxYear);
  if (!scopeBinding) {
    return activeVersion;
  }

  return (
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
          WHERE id = ?
        `,
      )
      .get(Number(scopeBinding.tax_policy_version_id)) as TaxPolicyVersionRow | undefined
  ) ?? activeVersion;
};

const buildResponse = (unitId?: number, taxYear?: number): TaxPolicyResponse => {
  const defaultSettings = buildDefaultTaxPolicySettings();
  const activeVersion = getActiveVersionRow();
  const versionRows = getVersionRows();
  const activeSettings = activeVersion ? parseSettingsJson(activeVersion.settings_json) : defaultSettings;
  const currentNotes = activeVersion?.maintenance_notes ?? DEFAULT_TAX_POLICY_MAINTENANCE_NOTES;

  return {
    currentSettings: activeSettings,
    defaultSettings,
    isCustomized: !isSameTaxPolicySettings(activeSettings, defaultSettings),
    currentVersionId: activeVersion?.id ?? 0,
    currentVersionName: activeVersion?.version_name ?? "默认税率版本",
    versions: versionRows.map(mapVersionSummary),
    currentScopeBinding: buildScopeBindingSummary(activeVersion, unitId, taxYear),
    currentNotes,
    defaultNotes: DEFAULT_TAX_POLICY_MAINTENANCE_NOTES,
    notesCustomized: currentNotes !== DEFAULT_TAX_POLICY_MAINTENANCE_NOTES,
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
  activateVersion(versionId: number): TaxPolicySaveResponse | null {
    const targetRow = database
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
      .get(versionId) as TaxPolicyVersionRow | undefined;

    if (!targetRow) {
      return null;
    }

    const currentResponse = buildResponse();
    if (currentResponse.currentVersionId === versionId) {
      return {
        ...currentResponse,
        invalidatedResults: false,
      };
    }

    activateVersionRecord(versionId);

    return {
      ...buildResponse(),
      invalidatedResults:
        buildTaxPolicySignature(currentResponse.currentSettings) !== targetRow.policy_signature,
    };
  },
  bindVersionToScope(payload: TaxPolicyBindScopePayload & { versionId: number }): TaxPolicySaveResponse | null {
    const targetRow = database
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
      .get(payload.versionId) as TaxPolicyVersionRow | undefined;

    if (!targetRow) {
      return null;
    }

    const currentScopeBinding = buildScopeBindingSummary(
      getActiveVersionRow(),
      payload.unitId,
      payload.taxYear,
    );

    if (currentScopeBinding && !currentScopeBinding.isInherited && currentScopeBinding.versionId === payload.versionId) {
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

    return {
      ...buildResponse(payload.unitId, payload.taxYear),
      invalidatedResults:
        currentScopeBinding?.policySignature !== targetRow.policy_signature,
    };
  },
  save(payload: TaxPolicyUpdatePayload): TaxPolicySaveResponse {
    const currentResponse = buildResponse();
    const nextSettings = normalizeTaxPolicySettings(payload);
    const nextNotes = payload.maintenanceNotes?.trim() ?? DEFAULT_TAX_POLICY_MAINTENANCE_NOTES;
    const defaultSettings = buildDefaultTaxPolicySettings();
    const settingsChanged = !isSameTaxPolicySettings(currentResponse.currentSettings, nextSettings);
    const notesChanged = currentResponse.currentNotes !== nextNotes;
    const nextPolicySignature = buildTaxPolicySignature(nextSettings);

    if (!settingsChanged && !notesChanged) {
      return {
        ...currentResponse,
        invalidatedResults: false,
      };
    }

    const activeVersion = getActiveVersionRow();

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

      return {
        ...buildResponse(),
        invalidatedResults: false,
      };
    }

    const existingVersion = database
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
          WHERE policy_signature = ?
        `,
      )
      .get(nextPolicySignature) as TaxPolicyVersionRow | undefined;

    if (existingVersion) {
      const reuseTransaction = database.transaction(() => {
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

      reuseTransaction();

      return {
        ...buildResponse(),
        invalidatedResults: settingsChanged,
      };
    }

    const saveTransaction = database.transaction(() => {
      const now = new Date();
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
          isSameTaxPolicySettings(defaultSettings, nextSettings)
            ? "默认税率版本"
            : buildVersionName(now),
          nextPolicySignature,
          JSON.stringify(nextSettings),
          nextNotes,
          now.toISOString(),
          now.toISOString(),
        );

      activateVersionRecord(Number(insertResult.lastInsertRowid));
    });

    saveTransaction();

    return {
      ...buildResponse(),
      invalidatedResults: settingsChanged,
    };
  },
};
