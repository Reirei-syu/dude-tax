import type { EmployeeAnnualTaxResult } from "@dude-tax/core";

export type AnnualTaxExplanation = {
  title: string;
  summary: string;
  detailLines: string[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const buildAnnualTaxExplanation = (
  result: EmployeeAnnualTaxResult,
): AnnualTaxExplanation => {
  const baseDetailLines = [
    `全年应纳税额为 ${formatCurrency(result.annualTaxPayable)} 元。`,
    `全年已预扣税额为 ${formatCurrency(result.annualTaxWithheld)} 元。`,
  ];

  if (result.settlementDirection === "payable") {
    return {
      title: "本年度应补税",
      summary: `按当前采用方案，全年已预扣税额低于最终应纳税额，需要补税 ${formatCurrency(result.annualTaxSettlement)} 元。`,
      detailLines: [
        ...baseDetailLines,
        `由于应纳税额高于已预扣税额，差额 ${formatCurrency(result.annualTaxSettlement)} 元需在年度汇算时补缴。`,
      ],
    };
  }

  if (result.settlementDirection === "refund") {
    return {
      title: "本年度应退税",
      summary: `按当前采用方案，全年已预扣税额高于最终应纳税额，可退税 ${formatCurrency(Math.abs(result.annualTaxSettlement))} 元。`,
      detailLines: [
        ...baseDetailLines,
        `由于已预扣税额高于应纳税额，差额 ${formatCurrency(Math.abs(result.annualTaxSettlement))} 元可在年度汇算时申请退回。`,
      ],
    };
  }

  return {
    title: "本年度已平",
    summary: "按当前采用方案，全年已预扣税额与最终应纳税额一致，本年度无需补税也无需退税。",
    detailLines: [...baseDetailLines, "全年应纳税额与已预扣税额一致，因此年度汇算结果为已平。"],
  };
};
