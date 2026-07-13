/** Dude Tax 前端运行时类型
 * 月度字段归类对齐「正常工资薪金所得」申报表
 */

/** 本期专项扣除（三险一金个人部分） */
export interface SocialDeductDetail {
  /** 基本养老保险费 */
  pension: number;
  /** 基本医疗保险费 */
  medical: number;
  /** 失业保险费 */
  unemployment: number;
  /** 住房公积金 */
  housingFund: number;
}

/**
 * 累计扣除（专项附加扣除 + 个人养老金）
 * 与申报表「累计扣除」区块一致
 */
export interface SpecialAddlDetail {
  /** 子女教育 */
  childEducation: number;
  /** 继续教育 */
  continuingEdu: number;
  /** 住房贷款利息 */
  housingLoan: number;
  /** 住房租金 */
  housingRent: number;
  /** 赡养老人 */
  elderlySupport: number;
  /** 3 岁以下婴幼儿照护 */
  infantCare: number;
  /** 个人养老金 */
  personalPension: number;
}

/** 本期其他扣除（不含捐赠；捐赠在「本期其他」） */
export interface OtherDeductDetail {
  /** 企业(职业)年金 */
  enterpriseAnnuity: number;
  /** 商业健康保险 */
  commercialHealth: number;
  /** 税延养老保险 */
  deferredPension: number;
  /** 公务交通费用 */
  officialTransport: number;
  /** 通讯费用 */
  communication: number;
  /** 律师办案费用 */
  lawyerFees: number;
}

export interface MonthInput {
  /** 本期收入 */
  salary: number;
  /** 本期免税收入 */
  freeIncome: number;
  /** 本期专项扣除 */
  social: SocialDeductDetail;
  /** 累计扣除（专项附加 + 个人养老金） */
  specialAddl: SpecialAddlDetail;
  /** 本期其他扣除 */
  other: OtherDeductDetail;
  /**
   * 准予扣除的捐赠额（申报表归在「本期其他」，计税仍计入其他扣除）
   */
  donation: number;
  /** 减免税额 */
  taxReduction: number;
  /** 协定减免 */
  treatyReduction: number;
  /**
   * 工资单上的个税扣缴（元）。
   * null = 未录入，不参与「实扣 vs 应预扣」差异；0 为合法实扣。
   * 不参与累计预扣引擎，仅对照台账。
   */
  payrollTaxWithheld: number | null;
}

export interface Employee {
  id: string;
  workspaceId: string;
  name: string;
  hireDate: string | null;
  leaveDate: string | null;
  isFirstTime: boolean;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  orgId: string;
  year: number;
}

export interface BoardNode {
  id: string;
  type:
    | 'roster'
    | 'salary-input'
    | 'bonus-optimizer'
    | 'insights'
    | 'tax-summary'
    | 'all-staff-tax';
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: { employeeId?: string; label?: string };
}

export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardLayout {
  nodes: BoardNode[];
  viewport?: BoardViewport;
}

export interface PendingConfirm {
  employeeId: string;
  type: 'hire' | 'leave';
  targetMonth: number;
  proposedDate: string;
}

export interface MonthCalcResult {
  month: number;
  cumIncome: number;
  cumFreeIncome: number;
  cumBasicDeduction: number;
  cumSocialDeduct: number;
  cumSpecialAddl: number;
  cumOtherDeduct: number;
  cumTaxable: number;
  thisMonthTax: number;
  cumTax: number;
  employmentMonthsUsed: number;
  rate: number;
  quickDeduction: number;
  salary: number;
  freeIncome: number;
  socialDeduct: number;
  specialAddl: number;
  otherDeduct: number;
  taxReduction: number;
  treatyReduction: number;
}

export interface EmployeeCalcInput {
  hireMonth: number;
  leaveMonth?: number;
  isFirstTime: boolean;
  months: MonthInput[];
  bonus?: number;
}

export interface BonusCompareResult {
  bonus: number;
  separateTax: number;
  separateRate: number;
  separateQuick: number;
  monthlyAvg: number;
  wageTaxableOnly: number;
  annualTaxWithoutBonus: number;
  annualTaxWithBonus: number;
  mergeIncrementalTax: number;
  recommended: 'separate' | 'merge';
  taxDelta: number;
  savings: number;
}

export const emptySocial = (): SocialDeductDetail => ({
  pension: 0,
  medical: 0,
  unemployment: 0,
  housingFund: 0,
});

export const emptySpecialAddl = (): SpecialAddlDetail => ({
  childEducation: 0,
  continuingEdu: 0,
  housingLoan: 0,
  housingRent: 0,
  elderlySupport: 0,
  infantCare: 0,
  personalPension: 0,
});

export const emptyOtherDeduct = (): OtherDeductDetail => ({
  enterpriseAnnuity: 0,
  commercialHealth: 0,
  deferredPension: 0,
  officialTransport: 0,
  communication: 0,
  lawyerFees: 0,
});

export const emptyMonth = (): MonthInput => ({
  salary: 0,
  freeIncome: 0,
  social: emptySocial(),
  specialAddl: emptySpecialAddl(),
  other: emptyOtherDeduct(),
  donation: 0,
  taxReduction: 0,
  treatyReduction: 0,
  payrollTaxWithheld: null,
});

export const emptyYearMonths = (): MonthInput[] =>
  Array.from({ length: 12 }, () => emptyMonth());

export function sumSocial(s: SocialDeductDetail): number {
  return s.pension + s.medical + s.unemployment + s.housingFund;
}

export function sumSpecialAddl(s: SpecialAddlDetail): number {
  return (
    s.childEducation +
    s.continuingEdu +
    s.housingLoan +
    s.housingRent +
    s.elderlySupport +
    s.infantCare +
    s.personalPension
  );
}

/** 本期其他扣除小计（不含捐赠） */
export function sumOtherDeduct(o: OtherDeductDetail): number {
  return (
    o.enterpriseAnnuity +
    o.commercialHealth +
    o.deferredPension +
    o.officialTransport +
    o.communication +
    o.lawyerFees
  );
}

/**
 * 引擎用合计：
 * - otherDeduct = 本期其他扣除 + 准予扣除的捐赠额
 * - 减免税额 / 协定减免 不冲减应纳税所得额，而冲减税额
 */
export function monthDeductTotals(m: MonthInput): {
  socialDeduct: number;
  specialAddl: number;
  otherDeduct: number;
  freeIncome: number;
  donation: number;
  taxReduction: number;
  treatyReduction: number;
} {
  const donation = m.donation || 0;
  return {
    socialDeduct: sumSocial(m.social),
    specialAddl: sumSpecialAddl(m.specialAddl),
    otherDeduct: sumOtherDeduct(m.other) + donation,
    freeIncome: m.freeIncome || 0,
    donation,
    taxReduction: m.taxReduction || 0,
    treatyReduction: m.treatyReduction || 0,
  };
}

export function cloneMonth(m: MonthInput): MonthInput {
  return {
    salary: m.salary,
    freeIncome: m.freeIncome || 0,
    social: { ...m.social },
    specialAddl: { ...emptySpecialAddl(), ...m.specialAddl },
    other: { ...emptyOtherDeduct(), ...m.other },
    donation: m.donation || 0,
    taxReduction: m.taxReduction || 0,
    treatyReduction: m.treatyReduction || 0,
    payrollTaxWithheld:
      m.payrollTaxWithheld == null || !Number.isFinite(m.payrollTaxWithheld)
        ? null
        : Math.max(0, m.payrollTaxWithheld),
  };
}

/** 规范化工资单扣缴：缺省/非有限 → null；否则非负元 */
export function normalizePayrollTaxWithheld(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

/**
 * 兼容旧数据迁入新结构
 */
export function normalizeMonthInput(raw: unknown): MonthInput {
  if (!raw || typeof raw !== 'object') return emptyMonth();
  const r = raw as Record<string, unknown>;

  if (r.social && typeof r.social === 'object') {
    const social = { ...emptySocial(), ...(r.social as SocialDeductDetail) };
    const saIn = r.specialAddl as Record<string, number> | undefined;
    // 丢弃旧字段 majorMedical（申报表累计扣除无此项）
    const specialAddl = { ...emptySpecialAddl() };
    if (saIn) {
      for (const k of Object.keys(emptySpecialAddl()) as (keyof SpecialAddlDetail)[]) {
        if (typeof saIn[k] === 'number') specialAddl[k] = saIn[k]!;
      }
    }
    const otherIn = r.other as Record<string, number> | undefined;
    const other = { ...emptyOtherDeduct() };
    let donation = Number(r.donation) || 0;
    if (otherIn) {
      for (const k of Object.keys(emptyOtherDeduct()) as (keyof OtherDeductDetail)[]) {
        if (typeof otherIn[k] === 'number') other[k] = otherIn[k]!;
      }
      // 旧 other.donation / other.other 并入顶层 donation
      if (typeof otherIn.donation === 'number') {
        donation += otherIn.donation;
      }
      if (typeof otherIn.other === 'number') {
        donation += otherIn.other;
      }
    }
    return {
      salary: Number(r.salary) || 0,
      freeIncome: Number(r.freeIncome) || 0,
      social,
      specialAddl,
      other,
      donation,
      taxReduction: Number(r.taxReduction) || 0,
      treatyReduction: Number(r.treatyReduction) || 0,
      payrollTaxWithheld: normalizePayrollTaxWithheld(r.payrollTaxWithheld),
    };
  }

  // 更旧：仅合计字段
  const socialTotal = Number(r.socialDeduct) || 0;
  const specialTotal = Number(r.specialAddl) || 0;
  const otherTotal = Number(r.otherDeduct) || 0;
  return {
    salary: Number(r.salary) || 0,
    freeIncome: 0,
    social: { ...emptySocial(), housingFund: socialTotal },
    specialAddl: { ...emptySpecialAddl(), childEducation: specialTotal },
    other: emptyOtherDeduct(),
    donation: otherTotal,
    taxReduction: 0,
    treatyReduction: 0,
    payrollTaxWithheld: normalizePayrollTaxWithheld(r.payrollTaxWithheld),
  };
}
