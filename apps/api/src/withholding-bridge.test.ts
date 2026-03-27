import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";

const testDatabasePath = path.join(process.cwd(), "data", "test", "withholding-bridge.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./services/annual-tax-service.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./repositories/month-record-repository.js"),
  import("./db/database.js"),
]);

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , , { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM annual_tax_result_versions;
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM units;
    DELETE FROM app_preferences;
    DELETE FROM tax_policy_scopes;
    DELETE FROM tax_policy_versions;
  `);
});

after(async () => {
  const [, , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("服务层可构造跨单位 / 跨年规则衔接上下文", async () => {
  const [
    { annualTaxService },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const unitA = unitRepository.create({
    unitName: "当前单位",
    remark: "",
  });
  const unitB = unitRepository.create({
    unitName: "前序单位",
    remark: "",
  });

  const employeeA = employeeRepository.create(unitA.id, {
    employeeCode: "EMP-A",
    employeeName: "员工甲",
    idNumber: "110101199001012345",
    hireDate: "2026-07-01",
    leaveDate: null,
    remark: "",
  });
  const employeeB = employeeRepository.create(unitB.id, {
    employeeCode: "EMP-B",
    employeeName: "员工甲-前单位",
    idNumber: "110101199001012345",
    hireDate: "2025-01-01",
    leaveDate: "2026-06-30",
    remark: "",
  });

  for (let taxMonth = 1; taxMonth <= 12; taxMonth += 1) {
    monthRecordRepository.upsert(unitB.id, employeeB.id, 2025, taxMonth, {
      status: "completed",
      salaryIncome: 5_000,
      annualBonus: 0,
      pensionInsurance: 0,
      medicalInsurance: 0,
      occupationalAnnuity: 0,
      housingFund: 0,
      supplementaryHousingFund: 0,
      unemploymentInsurance: 0,
      workInjuryInsurance: 0,
      withheldTax: 0,
      supplementarySalaryIncome: 0,
      supplementaryWithheldTaxAdjustment: 0,
      supplementarySourcePeriodLabel: "",
      supplementaryRemark: "",
      infantCareDeduction: 0,
      childEducationDeduction: 0,
      continuingEducationDeduction: 0,
      housingLoanInterestDeduction: 0,
      housingRentDeduction: 0,
      elderCareDeduction: 0,
      otherDeduction: 0,
      taxReductionExemption: 0,
      remark: "",
    });
  }

  for (let taxMonth = 1; taxMonth <= 6; taxMonth += 1) {
    monthRecordRepository.upsert(unitB.id, employeeB.id, 2026, taxMonth, {
      status: "completed",
      salaryIncome: 8_000,
      annualBonus: 0,
      pensionInsurance: 0,
      medicalInsurance: 0,
      occupationalAnnuity: 0,
      housingFund: 0,
      supplementaryHousingFund: 0,
      unemploymentInsurance: 0,
      workInjuryInsurance: 0,
      withheldTax: 100,
      supplementarySalaryIncome: 0,
      supplementaryWithheldTaxAdjustment: 0,
      supplementarySourcePeriodLabel: "",
      supplementaryRemark: "",
      infantCareDeduction: 0,
      childEducationDeduction: 0,
      continuingEducationDeduction: 0,
      housingLoanInterestDeduction: 0,
      housingRentDeduction: 0,
      elderCareDeduction: 0,
      otherDeduction: 0,
      taxReductionExemption: 0,
      remark: "",
    });
  }

  monthRecordRepository.upsert(unitA.id, employeeA.id, 2026, 7, {
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
    supplementarySalaryIncome: 0,
    supplementaryWithheldTaxAdjustment: 0,
    supplementarySourcePeriodLabel: "",
    supplementaryRemark: "",
    infantCareDeduction: 0,
    childEducationDeduction: 0,
    continuingEducationDeduction: 0,
    housingLoanInterestDeduction: 0,
    housingRentDeduction: 0,
    elderCareDeduction: 0,
    otherDeduction: 0,
    taxReductionExemption: 0,
    remark: "",
  });

  const bridgeContext = annualTaxService.buildWithholdingBridgeContext(
    unitA.id,
    2026,
    employeeA.id,
  );

  assert.equal(bridgeContext.relatedEmployeeIds.length, 2);
  assert.equal(bridgeContext.carryInCompletedRecords.length, 6);
  assert.equal(bridgeContext.carryInCompletedRecords.every((record) => record.unitId === unitB.id), true);
  assert.equal(bridgeContext.derivedFirstSalaryMonthInYear, 1);
  assert.equal(bridgeContext.derivedPreviousYearIncomeUnder60k, true);
});
