import { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { GlassCard } from '../common/GlassCard';
import { NumberInput } from '../common/NumberInput';
import { ChineseDateInput } from '../common/ChineseDateInput';
import { EmployeeCombobox } from '../common/EmployeeCombobox';
import { useTaxStore } from '../../lib/store/useTaxStore';
import {
  emptyYearMonths,
  monthDeductTotals,
  sumOtherDeduct,
  sumSocial,
  sumSpecialAddl,
  type OtherDeductDetail,
  type SocialDeductDetail,
  type SpecialAddlDetail,
} from '../../types';
import { formatYuan } from '../../lib/tax/fen';
import { BASIC_DEDUCTION_PER_MONTH } from '../../lib/tax/brackets';
import {
  buildExportFilename,
  buildSalaryCsv,
  buildSalaryImportTemplate,
  buildTemplateFilename,
  downloadSalaryCsv,
  groupSalaryCsvRows,
  parseSalaryCsv,
  peopleFromStore,
} from '../../lib/io/salaryCsv';

/** 对齐申报表：本期专项扣除 */
const SOCIAL_FIELDS: { key: keyof SocialDeductDetail; label: string }[] = [
  { key: 'pension', label: '基本养老保险费' },
  { key: 'medical', label: '基本医疗保险费' },
  { key: 'unemployment', label: '失业保险费' },
  { key: 'housingFund', label: '住房公积金' },
];

/** 对齐申报表：累计扣除 */
const SPECIAL_FIELDS: { key: keyof SpecialAddlDetail; label: string }[] = [
  { key: 'childEducation', label: '子女教育' },
  { key: 'housingLoan', label: '住房贷款利息' },
  { key: 'housingRent', label: '住房租金' },
  { key: 'elderlySupport', label: '赡养老人' },
  { key: 'continuingEdu', label: '继续教育' },
  { key: 'infantCare', label: '3岁以下婴幼儿照护' },
  { key: 'personalPension', label: '个人养老金' },
];

/** 对齐申报表：本期其他扣除（不含捐赠） */
const OTHER_FIELDS: { key: keyof OtherDeductDetail; label: string }[] = [
  { key: 'enterpriseAnnuity', label: '企业(职业)年金' },
  { key: 'commercialHealth', label: '商业健康保险' },
  { key: 'deferredPension', label: '税延养老保险' },
  { key: 'officialTransport', label: '公务交通费用' },
  { key: 'communication', label: '通讯费用' },
  { key: 'lawyerFees', label: '律师办案费用' },
];

export function SalaryInputCard({ fill = false }: { fill?: boolean }) {
  const selectedId = useTaxStore((s) => s.selectedEmployeeId);
  const employees = useTaxStore((s) => s.employees);
  const monthlyRecords = useTaxStore((s) => s.monthlyRecords);
  const bonusRecords = useTaxStore((s) => s.bonusRecords);
  const organization = useTaxStore((s) => s.organization);
  const updateMonthSalary = useTaxStore((s) => s.updateMonthSalary);
  const updateMonthFreeIncome = useTaxStore((s) => s.updateMonthFreeIncome);
  const updateMonthSocial = useTaxStore((s) => s.updateMonthSocial);
  const updateMonthSpecialAddl = useTaxStore((s) => s.updateMonthSpecialAddl);
  const updateMonthOther = useTaxStore((s) => s.updateMonthOther);
  const updateMonthDonation = useTaxStore((s) => s.updateMonthDonation);
  const updateMonthTaxReduction = useTaxStore((s) => s.updateMonthTaxReduction);
  const updateMonthTreatyReduction = useTaxStore(
    (s) => s.updateMonthTreatyReduction,
  );
  const copyMonthToFollowing = useTaxStore((s) => s.copyMonthToFollowing);
  const applySalaryImport = useTaxStore((s) => s.applySalaryImport);
  const setBonus = useTaxStore((s) => s.setBonus);
  const banner = useTaxStore((s) => s.statusBanner);
  const setHireDate = useTaxStore((s) => s.setHireDate);
  const setLeaveDate = useTaxStore((s) => s.setLeaveDate);
  const workspace = useTaxStore((s) => s.workspace);

  const [editMonth, setEditMonth] = useState(1);
  /** 明细录入区展开；折叠后便于查看全年 1–12 月速览 */
  const [detailExpanded, setDetailExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const employeeCount = Object.keys(employees).length;
  const emp = selectedId ? employees[selectedId] : null;
  const months = selectedId
    ? monthlyRecords[selectedId] ?? emptyYearMonths()
    : emptyYearMonths();
  const bonus = selectedId ? (bonusRecords[selectedId] ?? 0) : 0;
  const yearHint = workspace?.year ?? new Date().getFullYear();
  const cur = months[editMonth - 1] ?? emptyYearMonths()[0]!;
  const totals = monthDeductTotals(cur);

  const handleExportAll = () => {
    const people = peopleFromStore(employees, monthlyRecords, bonusRecords);
    if (people.length === 0) {
      toast.message('暂无员工可导出，可先导入 CSV 或添加员工');
      return;
    }
    const csv = buildSalaryCsv(people);
    const filename = buildExportFilename(organization?.name, workspace?.year);
    downloadSalaryCsv(filename, csv);
    toast.success(`已导出 ${people.length} 人 × 12 月（${filename}）`);
  };

  const handleExportCurrent = () => {
    if (!emp) {
      toast.message('请先选择员工');
      return;
    }
    const people = peopleFromStore(
      employees,
      monthlyRecords,
      bonusRecords,
      emp.id,
    );
    const csv = buildSalaryCsv(people);
    const filename = buildExportFilename(
      `${organization?.name ?? '单位'}_${emp.name}`,
      workspace?.year,
    );
    downloadSalaryCsv(filename, csv);
    toast.success(`已导出 ${emp.name} 的 12 月数据`);
  };

  const handleDownloadTemplate = () => {
    const names = Object.values(employees)
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'zh'));
    const csv = buildSalaryImportTemplate(names);
    const filename = buildTemplateFilename(
      organization?.name,
      workspace?.year,
    );
    downloadSalaryCsv(filename, csv);
    if (names.length > 0) {
      toast.success(
        `已下载导入模板：${names.length} 人 × 12 月空白行（${filename}）`,
      );
    } else {
      toast.success(
        `已下载导入模板（含示例员工与 1 月样例金额，可按需修改）`,
      );
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSalaryCsv(text);
      if (parsed.rows.length === 0) {
        const msg =
          parsed.errors[0] ?? '未解析到有效数据，请确认表头含「姓名」「月份」';
        toast.error(msg);
        return;
      }
      const plan = groupSalaryCsvRows(parsed.rows);
      const result = applySalaryImport(plan, { createMissing: true });
      const parts = [
        `更新 ${result.updated} 人`,
        result.created > 0 ? `新建 ${result.created} 人` : null,
        `写入 ${result.monthsWritten} 条月度`,
      ].filter(Boolean);
      if (parsed.errors.length > 0) {
        toast.message(
          `导入完成（${parts.join('，')}）；${parsed.errors.length} 行有告警`,
        );
      } else {
        toast.success(`导入成功：${parts.join('，')}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('读取文件失败，请使用 UTF-8 CSV');
    }
  };

  const ioToolbar = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleImportFile(f);
        }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        title="导出当前单位全部员工 1–12 月工资明细为 CSV（Excel 可打开）"
        onClick={handleExportAll}
      >
        <Download size={13} />
        导出全部
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        title="仅导出当前选中员工"
        disabled={!emp}
        onClick={handleExportCurrent}
      >
        <Download size={13} />
        导出当前
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        title={
          employeeCount > 0
            ? '按当前花名册生成空白导入模板（姓名+12月），填好后点「导入 CSV」'
            : '下载标准导入模板（含示例员工与样例金额），Excel 打开填写后导入'
        }
        onClick={handleDownloadTemplate}
      >
        <FileSpreadsheet size={13} />
        下载模板
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        title="从 CSV 导入；按姓名匹配，不存在则自动新建员工"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={13} />
        导入 CSV
      </button>
      <span className="text-[10px] leading-relaxed text-[var(--text-faint)]">
        建议先「下载模板」填写再导入；按姓名匹配，缺员自动建档
      </span>
    </div>
  );

  const employeeSelector = <EmployeeCombobox label="编辑员工" />;

  if (employeeCount === 0) {
    return (
      <GlassCard title="月度工资录入" subtitle="对齐正常工资薪金申报项" fill={fill}>
        {employeeSelector}
        {ioToolbar}
        <p className="m-0 text-sm text-[var(--text-muted)]">
          请先在「员工花名册」中添加员工，或直接「导入 CSV」批量建档。
        </p>
      </GlassCard>
    );
  }

  if (!emp) {
    return (
      <GlassCard title="月度工资录入" subtitle="对齐正常工资薪金申报项" fill={fill}>
        {employeeSelector}
        {ioToolbar}
        <p className="m-0 text-sm text-[var(--text-muted)]">
          请从上方搜索或选择要编辑的员工。
        </p>
      </GlassCard>
    );
  }

  const handleCopyFollowing = () => {
    if (editMonth >= 12) {
      toast.message('已是 12 月，无需复制到后续月份');
      return;
    }
    copyMonthToFollowing(emp.id, editMonth);
    toast.success(`已将 ${editMonth} 月数据复制到 ${editMonth + 1}–12 月`);
  };

  return (
    <GlassCard
      title="月度工资录入"
      subtitle="字段归类对齐「正常工资薪金所得」申报表"
      fill={fill}
      headerRight={
        <div className="flex flex-col gap-1.5 text-[11px] text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="shrink-0">入职</span>
            <ChineseDateInput
              value={emp.hireDate}
              yearHint={yearHint}
              ariaLabel="入职日期"
              onChange={(iso) => {
                if (iso) setHireDate(emp.id, iso);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="shrink-0">离职</span>
            <ChineseDateInput
              value={emp.leaveDate}
              yearHint={yearHint}
              allowEmpty
              ariaLabel="离职日期"
              onChange={(iso) => setLeaveDate(emp.id, iso)}
            />
          </div>
        </div>
      }
    >
      {employeeSelector}
      {ioToolbar}
      {banner && <div className="banner banner-info mb-3">{banner}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">
          所得期间（月）
        </span>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn btn-sm ${
                editMonth === m ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={() => setEditMonth(m)}
            >
              {m}月
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={editMonth >= 12}
          title={
            editMonth >= 12
              ? '已是 12 月'
              : `将 ${editMonth} 月全部明细复制到 ${editMonth + 1}–12 月`
          }
          onClick={handleCopyFollowing}
        >
          <Copy size={13} />
          复制到后续月份
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          title={
            detailExpanded
              ? '折叠明细录入，便于浏览全年 1–12 月列表'
              : '展开明细录入区'
          }
          aria-expanded={detailExpanded}
          aria-controls="salary-detail-entry"
          onClick={() => setDetailExpanded((v) => !v)}
        >
          {detailExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {detailExpanded ? '折叠明细' : '展开明细'}
        </button>
      </div>

      <div className={fill ? 'min-h-0 space-y-3 overflow-auto' : 'space-y-3'}>
        {detailExpanded && (
        <div id="salary-detail-entry" className="space-y-3">
        {/* 本期收入及免税收入 | 年终奖 */}
        <div className="salary-income-bonus-row">
          <section className="salary-section">
            <div className="salary-section-head">
              <h4 className="salary-section-title">
                本期收入及免税收入（{editMonth}月）
              </h4>
            </div>
            <div className="salary-field-grid">
              <label className="salary-field">
                <span>本期收入</span>
                <NumberInput
                  value={cur.salary}
                  ariaLabel={`${editMonth}月本期收入`}
                  onChange={(v) => updateMonthSalary(emp.id, editMonth, v)}
                />
              </label>
              <label className="salary-field">
                <span>本期免税收入</span>
                <NumberInput
                  value={cur.freeIncome}
                  ariaLabel={`${editMonth}月本期免税收入`}
                  onChange={(v) =>
                    updateMonthFreeIncome(emp.id, editMonth, v)
                  }
                />
              </label>
            </div>
          </section>

          <section className="salary-section">
            <div className="salary-section-head">
              <h4 className="salary-section-title">年终奖（全年一次性奖金）</h4>
              <span className="text-[10px] text-[var(--text-faint)]">
                按员工 · 不随月份变
              </span>
            </div>
            <div className="salary-field-grid">
              <label className="salary-field">
                <span>年终奖金额（元）</span>
                <NumberInput
                  value={bonus}
                  step={100}
                  ariaLabel={`${emp.name}年终奖金额`}
                  onChange={(v) => setBonus(emp.id, v)}
                />
              </label>
            </div>
            <p className="mt-2 mb-0 text-[11px] leading-relaxed text-[var(--text-muted)]">
              可在「年终奖优化」对比计税。当前：
              <span className="num font-medium text-[var(--text)]">
                {bonus > 0 ? `${formatYuan(bonus)} 元` : '未填'}
              </span>
            </p>
          </section>
        </div>

        {/* 本期专项扣除 */}
        <section className="salary-section">
          <div className="salary-section-head">
            <h4 className="salary-section-title">本期专项扣除</h4>
            <span className="num text-xs text-[var(--text-muted)]">
              小计 {formatYuan(sumSocial(cur.social))}
            </span>
          </div>
          <div className="salary-field-grid">
            {SOCIAL_FIELDS.map(({ key, label }) => (
              <label key={key} className="salary-field">
                <span>{label}</span>
                <NumberInput
                  value={cur.social[key]}
                  ariaLabel={`${editMonth}月${label}`}
                  onChange={(v) =>
                    updateMonthSocial(emp.id, editMonth, key, v)
                  }
                />
              </label>
            ))}
          </div>
        </section>

        {/* 累计扣除 */}
        <section className="salary-section">
          <div className="salary-section-head">
            <h4 className="salary-section-title">累计扣除</h4>
            <span className="num text-xs text-[var(--text-muted)]">
              小计 {formatYuan(sumSpecialAddl(cur.specialAddl))}
            </span>
          </div>
          <p className="mt-0 mb-2 text-[10px] text-[var(--text-faint)]">
            专项附加扣除及个人养老金（按申报表「累计扣除」归类，预估时按本月填列值累计）
          </p>
          <div className="salary-field-grid">
            {SPECIAL_FIELDS.map(({ key, label }) => (
              <label key={key} className="salary-field">
                <span>{label}</span>
                <NumberInput
                  value={cur.specialAddl[key]}
                  ariaLabel={`${editMonth}月${label}`}
                  onChange={(v) =>
                    updateMonthSpecialAddl(emp.id, editMonth, key, v)
                  }
                />
              </label>
            ))}
          </div>
        </section>

        {/* 本期其他扣除 */}
        <section className="salary-section">
          <div className="salary-section-head">
            <h4 className="salary-section-title">本期其他扣除</h4>
            <span className="num text-xs text-[var(--text-muted)]">
              小计 {formatYuan(sumOtherDeduct(cur.other))}
            </span>
          </div>
          <div className="salary-field-grid">
            {OTHER_FIELDS.map(({ key, label }) => (
              <label key={key} className="salary-field">
                <span>{label}</span>
                <NumberInput
                  value={cur.other[key]}
                  ariaLabel={`${editMonth}月${label}`}
                  onChange={(v) =>
                    updateMonthOther(emp.id, editMonth, key, v)
                  }
                />
              </label>
            ))}
          </div>
        </section>

        {/* 本期其他：捐赠 + 减免（对齐申报表） */}
        <section className="salary-section">
          <div className="salary-section-head">
            <h4 className="salary-section-title">本期其他</h4>
          </div>
          <div className="salary-field-grid">
            <label className="salary-field">
              <span>准予扣除的捐赠额</span>
              <NumberInput
                value={cur.donation}
                ariaLabel={`${editMonth}月准予扣除的捐赠额`}
                onChange={(v) => updateMonthDonation(emp.id, editMonth, v)}
              />
            </label>
            <label className="salary-field">
              <span>减免税额</span>
              <NumberInput
                value={cur.taxReduction}
                ariaLabel={`${editMonth}月减免税额`}
                onChange={(v) =>
                  updateMonthTaxReduction(emp.id, editMonth, v)
                }
              />
            </label>
            <label className="salary-field">
              <span>协定减免</span>
              <NumberInput
                value={cur.treatyReduction}
                ariaLabel={`${editMonth}月协定减免`}
                onChange={(v) =>
                  updateMonthTreatyReduction(emp.id, editMonth, v)
                }
              />
            </label>
            <label className="salary-field">
              <span>减除费用标准（参考）</span>
              <input
                className="field num-input text-right opacity-70"
                readOnly
                value={BASIC_DEDUCTION_PER_MONTH.toFixed(2)}
                aria-label="减除费用标准"
                title="系统按 5000×任职月数自动计算累计减除费用"
              />
            </label>
          </div>
          <p className="mt-2 mb-0 text-[10px] text-[var(--text-faint)]">
            捐赠额计税时并入「其他扣除」；减免税额/协定减免冲减税额。减除费用由系统按
            5000×任职月数自动累计；已缴税额由预扣引擎按月累计，无需手工录入。
          </p>
        </section>

        <div className="banner banner-info">
          {editMonth} 月：收入{' '}
          <span className="num font-semibold">{formatYuan(cur.salary)}</span>
          {' · '}免税{' '}
          <span className="num font-semibold">
            {formatYuan(totals.freeIncome)}
          </span>
          {' · '}专项{' '}
          <span className="num font-semibold">
            {formatYuan(totals.socialDeduct)}
          </span>
          {' · '}累计扣除{' '}
          <span className="num font-semibold">
            {formatYuan(totals.specialAddl)}
          </span>
          {' · '}其他扣除{' '}
          <span className="num font-semibold">
            {formatYuan(totals.otherDeduct)}
          </span>
          {' · '}减免{' '}
          <span className="num font-semibold">
            {formatYuan(totals.taxReduction + totals.treatyReduction)}
          </span>
        </div>
        </div>
        )}

        {!detailExpanded && (
          <div className="banner banner-info">
            明细已折叠 · 当前 {editMonth} 月 · 收入{' '}
            <span className="num font-semibold">{formatYuan(cur.salary)}</span>
            {' · '}点击下方月份可切换；点「展开明细」继续编辑
          </div>
        )}

        <section className="salary-section">
          <h4 className="salary-section-title">全年速览</h4>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>月</th>
                  <th className="text-right!">收入</th>
                  <th className="text-right!">免税</th>
                  <th className="text-right!">专项</th>
                  <th className="text-right!">累计扣除</th>
                  <th className="text-right!">其他</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => {
                  const t = monthDeductTotals(m);
                  return (
                    <tr
                      key={i}
                      className={
                        i + 1 === editMonth
                          ? 'is-selected cursor-pointer'
                          : 'cursor-pointer'
                      }
                      onClick={() => setEditMonth(i + 1)}
                    >
                      <td className="font-medium">{i + 1}月</td>
                      <td className="num text-right">
                        {formatYuan(m.salary)}
                      </td>
                      <td className="num text-right">
                        {formatYuan(t.freeIncome)}
                      </td>
                      <td className="num text-right">
                        {formatYuan(t.socialDeduct)}
                      </td>
                      <td className="num text-right">
                        {formatYuan(t.specialAddl)}
                      </td>
                      <td className="num text-right">
                        {formatYuan(t.otherDeduct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </GlassCard>
  );
}
