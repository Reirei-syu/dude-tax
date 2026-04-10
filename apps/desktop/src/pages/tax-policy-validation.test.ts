import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultTaxPolicySettings } from "../../../../packages/core/src/index";
import { validateTaxPolicyDraft } from "./tax-policy-validation";

test("负数减除费用和过长说明条目会返回校验问题", () => {
  const settings = buildDefaultTaxPolicySettings();
  settings.basicDeductionAmount = -1;

  const issues = validateTaxPolicyDraft(settings, [
    {
      id: "item-1",
      title: "专项附加扣除说明",
      body: "x".repeat(2001),
      illustrationDataUrl: "",
      sortOrder: 0,
    },
  ]);

  assert(
    issues.some(
      (issue) => issue.section === "basic" && issue.message.includes("基本减除费用"),
    ),
  );
  assert(
    issues.some(
      (issue) =>
        issue.section === "policyItems" && issue.message.includes("正文不能超过 2000"),
    ),
  );
});

test("税率越界和阈值顺序错误会返回表格校验问题", () => {
  const settings = buildDefaultTaxPolicySettings();
  settings.comprehensiveTaxBrackets[0] = {
    ...settings.comprehensiveTaxBrackets[0]!,
    rate: 120,
  };
  settings.comprehensiveTaxBrackets[1] = {
    ...settings.comprehensiveTaxBrackets[1]!,
    maxAnnualIncome: 30_000,
  };
  settings.bonusTaxBrackets[6] = {
    ...settings.bonusTaxBrackets[6]!,
    maxAverageMonthlyIncome: 90_000,
  };

  const issues = validateTaxPolicyDraft(settings, []);

  assert(
    issues.some(
      (issue) =>
        issue.section === "comprehensive" &&
        issue.rowIndex === 0 &&
        issue.message.includes("税率必须在 0 到 100"),
    ),
  );
  assert(
    issues.some(
      (issue) =>
        issue.section === "comprehensive" && issue.message.includes("阈值必须递增"),
    ),
  );
  assert(
    issues.some(
      (issue) => issue.section === "bonus" && issue.message.includes("最后一档必须为不封顶"),
    ),
  );
});
