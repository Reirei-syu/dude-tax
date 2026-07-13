/**
 * 月度工资 CSV 导入 / 导出
 * 格式：UTF-8 BOM，Excel 可直接打开；一行 = 一人一月
 */

import type {
  Employee,
  MonthInput,
  OtherDeductDetail,
  SocialDeductDetail,
  SpecialAddlDetail,
} from '../../types';
import {
  cloneMonth,
  emptyMonth,
  emptyOtherDeduct,
  emptyYearMonths,
} from '../../types';

/** 表头列定义（顺序固定，导入按表头名匹配） */
export const SALARY_CSV_COLUMNS = [
  { key: 'name', label: '姓名' },
  { key: 'month', label: '月份' },
  { key: 'salary', label: '本期收入' },
  { key: 'freeIncome', label: '本期免税收入' },
  { key: 'pension', label: '基本养老保险费' },
  { key: 'medical', label: '基本医疗保险费' },
  { key: 'unemployment', label: '失业保险费' },
  { key: 'housingFund', label: '住房公积金' },
  { key: 'childEducation', label: '子女教育' },
  { key: 'housingLoan', label: '住房贷款利息' },
  { key: 'housingRent', label: '住房租金' },
  { key: 'elderlySupport', label: '赡养老人' },
  { key: 'continuingEdu', label: '继续教育' },
  { key: 'infantCare', label: '3岁以下婴幼儿照护' },
  { key: 'personalPension', label: '个人养老金' },
  { key: 'enterpriseAnnuity', label: '企业(职业)年金' },
  { key: 'commercialHealth', label: '商业健康保险' },
  { key: 'deferredPension', label: '税延养老保险' },
  { key: 'officialTransport', label: '公务交通费用' },
  { key: 'communication', label: '通讯费用' },
  { key: 'lawyerFees', label: '律师办案费用' },
  { key: 'donation', label: '准予扣除的捐赠额' },
  { key: 'taxReduction', label: '减免税额' },
  { key: 'treatyReduction', label: '协定减免' },
  { key: 'payrollTaxWithheld', label: '工资单个税扣缴' },
  { key: 'bonus', label: '年终奖' },
] as const;

export type SalaryCsvFieldKey = (typeof SALARY_CSV_COLUMNS)[number]['key'];

export interface SalaryExportPerson {
  name: string;
  months: MonthInput[];
  bonus: number;
}

export interface SalaryCsvRow {
  name: string;
  month: number;
  /** 部分字段补丁（空单元格不覆盖） */
  data: MonthInput | PartialMonthInput;
  bonus: number | null;
  /** 年终奖列是否在本行有显式值 */
  bonusProvided: boolean;
}

export interface ParseSalaryCsvResult {
  rows: SalaryCsvRow[];
  errors: string[];
  /** 表头中未识别的列（忽略） */
  unknownHeaders: string[];
}

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 简易 CSV 行解析（支持引号转义） */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function splitCsvLines(text: string): string[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n').filter((l) => l.trim().length > 0);
}

/**
 * 解析金额：空单元格 → undefined（导入时不覆盖已有值）
 * 显式 0 → 0（覆盖为 0）
 */
export function parseAmountOptional(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const cleaned = raw.replace(/,/g, '').replace(/￥|¥|元/g, '').trim();
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/** NaN 哨兵：partial 补丁中表示「该字段未提供」 */
export const FIELD_ABSENT = Number.NaN;

export type PartialMonthInput = MonthInput & { __partial: true };

function parseMonth(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const s = raw.trim().replace(/月$/, '');
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return n;
}

function monthToFlat(m: MonthInput, bonus: number): Record<SalaryCsvFieldKey, string | number> {
  return {
    name: '',
    month: 0,
    salary: m.salary || 0,
    freeIncome: m.freeIncome || 0,
    pension: m.social.pension || 0,
    medical: m.social.medical || 0,
    unemployment: m.social.unemployment || 0,
    housingFund: m.social.housingFund || 0,
    childEducation: m.specialAddl.childEducation || 0,
    housingLoan: m.specialAddl.housingLoan || 0,
    housingRent: m.specialAddl.housingRent || 0,
    elderlySupport: m.specialAddl.elderlySupport || 0,
    continuingEdu: m.specialAddl.continuingEdu || 0,
    infantCare: m.specialAddl.infantCare || 0,
    personalPension: m.specialAddl.personalPension || 0,
    enterpriseAnnuity: m.other.enterpriseAnnuity || 0,
    commercialHealth: m.other.commercialHealth || 0,
    deferredPension: m.other.deferredPension || 0,
    officialTransport: m.other.officialTransport || 0,
    communication: m.other.communication || 0,
    lawyerFees: m.other.lawyerFees || 0,
    donation: m.donation || 0,
    taxReduction: m.taxReduction || 0,
    treatyReduction: m.treatyReduction || 0,
    // 未录入导出空单元格（勿写 0，避免与合法实扣 0 混淆于「未填」语义时由导入空不覆盖处理）
    payrollTaxWithheld:
      m.payrollTaxWithheld == null || !Number.isFinite(m.payrollTaxWithheld)
        ? ''
        : m.payrollTaxWithheld,
    bonus: bonus || 0,
  };
}

function orAbsent(v: number | undefined): number {
  return v === undefined ? FIELD_ABSENT : v;
}

/**
 * 将 CSV 单元格转为「部分更新」月度补丁：
 * 空单元格 → FIELD_ABSENT（NaN），导入时保留库内原值
 * 显式数字（含 0）→ 覆盖
 */
export function flatToMonthPatch(
  cells: Partial<Record<SalaryCsvFieldKey, string>>,
): PartialMonthInput {
  const social: SocialDeductDetail = {
    pension: orAbsent(parseAmountOptional(cells.pension)),
    medical: orAbsent(parseAmountOptional(cells.medical)),
    unemployment: orAbsent(parseAmountOptional(cells.unemployment)),
    housingFund: orAbsent(parseAmountOptional(cells.housingFund)),
  };
  const specialAddl: SpecialAddlDetail = {
    childEducation: orAbsent(parseAmountOptional(cells.childEducation)),
    housingLoan: orAbsent(parseAmountOptional(cells.housingLoan)),
    housingRent: orAbsent(parseAmountOptional(cells.housingRent)),
    elderlySupport: orAbsent(parseAmountOptional(cells.elderlySupport)),
    continuingEdu: orAbsent(parseAmountOptional(cells.continuingEdu)),
    infantCare: orAbsent(parseAmountOptional(cells.infantCare)),
    personalPension: orAbsent(parseAmountOptional(cells.personalPension)),
  };
  const other: OtherDeductDetail = {
    enterpriseAnnuity: orAbsent(parseAmountOptional(cells.enterpriseAnnuity)),
    commercialHealth: orAbsent(parseAmountOptional(cells.commercialHealth)),
    deferredPension: orAbsent(parseAmountOptional(cells.deferredPension)),
    officialTransport: orAbsent(parseAmountOptional(cells.officialTransport)),
    communication: orAbsent(parseAmountOptional(cells.communication)),
    lawyerFees: orAbsent(parseAmountOptional(cells.lawyerFees)),
  };
  return {
    salary: orAbsent(parseAmountOptional(cells.salary)),
    freeIncome: orAbsent(parseAmountOptional(cells.freeIncome)),
    social,
    specialAddl,
    other,
    donation: orAbsent(parseAmountOptional(cells.donation)),
    taxReduction: orAbsent(parseAmountOptional(cells.taxReduction)),
    treatyReduction: orAbsent(parseAmountOptional(cells.treatyReduction)),
    // 空 → NaN 哨兵（merge 时保留库内值）；有数字含 0 → 覆盖
    payrollTaxWithheld: orAbsent(parseAmountOptional(cells.payrollTaxWithheld)),
    __partial: true,
  };
}

/** 导出人员列表为 CSV 文本（含 BOM） */
export function buildSalaryCsv(people: SalaryExportPerson[]): string {
  const headers = SALARY_CSV_COLUMNS.map((c) => c.label);
  const lines: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const person of people) {
    const months =
      person.months?.length === 12
        ? person.months
        : emptyYearMonths().map((m, i) =>
            person.months?.[i] ? cloneMonth(person.months[i]!) : m,
          );
    for (let i = 0; i < 12; i++) {
      const flat = monthToFlat(months[i] ?? emptyMonth(), person.bonus || 0);
      const row = SALARY_CSV_COLUMNS.map((col) => {
        if (col.key === 'name') return escapeCsvCell(person.name);
        if (col.key === 'month') return String(i + 1);
        return escapeCsvCell(flat[col.key]);
      });
      lines.push(row.join(','));
    }
  }

  return `\uFEFF${lines.join('\n')}\n`;
}

/** 解析导入 CSV */
export function parseSalaryCsv(text: string): ParseSalaryCsvResult {
  const lines = splitCsvLines(text);
  const errors: string[] = [];
  const unknownHeaders: string[] = [];
  if (lines.length === 0) {
    return { rows: [], errors: ['文件为空'], unknownHeaders };
  }

  const headerCells = parseCsvLine(lines[0]!);
  const labelToKey = new Map<string, SalaryCsvFieldKey>(
    SALARY_CSV_COLUMNS.map((c) => [c.label, c.key]),
  );
  // 兼容无「年」后缀等轻微差异
  labelToKey.set('3岁以下婴幼儿照护', 'infantCare');
  labelToKey.set('企业职业年金', 'enterpriseAnnuity');
  labelToKey.set('企业（职业）年金', 'enterpriseAnnuity');

  const colIndex = new Map<SalaryCsvFieldKey, number>();
  headerCells.forEach((h, idx) => {
    const key = labelToKey.get(h.trim());
    if (key) colIndex.set(key, idx);
    else if (h.trim()) unknownHeaders.push(h.trim());
  });

  if (!colIndex.has('name') || !colIndex.has('month')) {
    errors.push('缺少必要列：姓名、月份');
    return { rows: [], errors, unknownHeaders };
  }

  const rows: SalaryCsvRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]!);
    if (cells.every((c) => !c)) continue;

    const get = (key: SalaryCsvFieldKey): string => {
      const idx = colIndex.get(key);
      if (idx == null) return '';
      return cells[idx] ?? '';
    };

    const name = get('name').trim();
    const month = parseMonth(get('month'));
    if (!name) {
      errors.push(`第 ${li + 1} 行：姓名为空，已跳过`);
      continue;
    }
    if (month == null) {
      errors.push(`第 ${li + 1} 行（${name}）：月份无效，已跳过`);
      continue;
    }

    const fieldMap: Partial<Record<SalaryCsvFieldKey, string>> = {};
    for (const col of SALARY_CSV_COLUMNS) {
      if (col.key === 'name' || col.key === 'month') continue;
      fieldMap[col.key] = get(col.key);
    }

    const bonusRaw = get('bonus');
    const bonusOpt = parseAmountOptional(bonusRaw);
    rows.push({
      name,
      month,
      data: flatToMonthPatch(fieldMap),
      bonus: bonusOpt === undefined ? null : bonusOpt,
      bonusProvided: bonusOpt !== undefined,
    });
  }

  return { rows, errors, unknownHeaders };
}

export interface SalaryImportPlan {
  /** 姓名 → 月度补丁（partial 合并）与可选年终奖 */
  byEmployeeName: Map<
    string,
    {
      months: Partial<Record<number, MonthInput | PartialMonthInput>>;
      bonus: number | null;
    }
  >;
  names: string[];
}

/** 将解析行按姓名聚合 */
export function groupSalaryCsvRows(rows: SalaryCsvRow[]): SalaryImportPlan {
  const byEmployeeName = new Map<
    string,
    {
      months: Partial<Record<number, MonthInput | PartialMonthInput>>;
      bonus: number | null;
    }
  >();

  for (const row of rows) {
    let entry = byEmployeeName.get(row.name);
    if (!entry) {
      entry = { months: {}, bonus: null };
      byEmployeeName.set(row.name, entry);
    }
    // 保留 partial 标记，勿 cloneMonth（会把 NaN 抹掉）
    entry.months[row.month] = row.data;
    // 年终奖：仅当 CSV 显式提供时更新；最后一次显式值生效
    if (row.bonusProvided && row.bonus != null) {
      entry.bonus = row.bonus;
    }
  }

  return {
    byEmployeeName,
    names: Array.from(byEmployeeName.keys()),
  };
}

/** 浏览器下载 CSV */
export function downloadSalaryCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildExportFilename(
  orgName: string | undefined,
  year: number | undefined,
): string {
  const org = (orgName || '单位').replace(/[\\/:*?"<>|]/g, '_');
  const y = year ?? new Date().getFullYear();
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `月度工资_${org}_${y}_${stamp}.csv`;
}

export function buildTemplateFilename(
  orgName: string | undefined,
  year: number | undefined,
): string {
  const org = (orgName || '单位').replace(/[\\/:*?"<>|]/g, '_');
  const y = year ?? new Date().getFullYear();
  return `月度工资导入模板_${org}_${y}.csv`;
}

/** 1 月样例金额，便于对照填写（可改可删） */
function sampleJanuaryMonth(): MonthInput {
  return {
    ...emptyMonth(),
    salary: 10_000,
    freeIncome: 0,
    social: {
      pension: 800,
      medical: 200,
      unemployment: 50,
      housingFund: 1_200,
    },
    specialAddl: {
      childEducation: 1_000,
      continuingEdu: 0,
      housingLoan: 0,
      housingRent: 0,
      elderlySupport: 0,
      infantCare: 0,
      personalPension: 0,
    },
    other: emptyOtherDeduct(),
    donation: 0,
    taxReduction: 0,
    treatyReduction: 0,
  };
}

/**
 * 生成导入模板 CSV
 * - 传入花名册姓名：每人 12 月空白行（金额为 0），便于直接填报
 * - 未传姓名：提供「示例员工」+ 1 月样例金额 + 2–12 月空白
 */
export function buildSalaryImportTemplate(employeeNames?: string[]): string {
  const names = (employeeNames ?? [])
    .map((n) => n.trim())
    .filter(Boolean);

  if (names.length === 0) {
    const months = emptyYearMonths();
    months[0] = sampleJanuaryMonth();
    return buildSalaryCsv([
      { name: '示例员工', months, bonus: 0 },
    ]);
  }

  return buildSalaryCsv(
    names.map((name) => ({
      name,
      months: emptyYearMonths(),
      bonus: 0,
    })),
  );
}

/** 从 store 员工映射构建导出列表 */
export function peopleFromStore(
  employees: Record<string, Employee>,
  monthlyRecords: Record<string, MonthInput[]>,
  bonusRecords: Record<string, number>,
  onlyEmployeeId?: string | null,
): SalaryExportPerson[] {
  const list = Object.values(employees)
    .filter((e) => (onlyEmployeeId ? e.id === onlyEmployeeId : true))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));

  return list.map((e) => ({
    name: e.name,
    months: monthlyRecords[e.id] ?? emptyYearMonths(),
    bonus: bonusRecords[e.id] ?? 0,
  }));
}
