import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

const DEFAULT_APP_PATH = path.resolve(
  process.cwd(),
  "dist-electron",
  "dude-tax-win32-x64",
  "dude-tax.exe",
);
const DEFAULT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  "docs",
  "e2e",
  "2026-04-10-release-preflight",
  "artifacts",
);
const DEFAULT_TAX_YEAR = 2026;

const EMPLOYEE_HEADERS = [
  "employeeCode",
  "employeeName",
  "idNumber",
  "hireDate",
  "leaveDate",
  "remark",
];

const MONTH_RECORD_HEADERS = [
  "employeeCode",
  "taxYear",
  "taxMonth",
  "salaryIncome",
  "annualBonus",
  "pensionInsurance",
  "medicalInsurance",
  "occupationalAnnuity",
  "housingFund",
  "supplementaryHousingFund",
  "unemploymentInsurance",
  "workInjuryInsurance",
  "withheldTax",
  "otherIncome",
  "otherIncomeRemark",
  "infantCareDeduction",
  "childEducationDeduction",
  "continuingEducationDeduction",
  "housingLoanInterestDeduction",
  "housingRentDeduction",
  "elderCareDeduction",
  "otherDeduction",
  "taxReductionExemption",
  "remark",
];

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`不支持的位置参数：${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：--${key}`);
    }

    args[key] = value;
    index += 1;
  }

  const appPath = path.resolve(args["app-path"] ?? DEFAULT_APP_PATH);
  const outputDir = path.resolve(args["output-dir"] ?? DEFAULT_OUTPUT_DIR);
  const remoteDebuggingPort = Number(args["remote-debugging-port"] ?? 9222);
  const taxYear = Number(args["tax-year"] ?? DEFAULT_TAX_YEAR);
  const unitName = String(args["unit-name"] ?? "发布前E2E单位").trim();

  if (!appPath) {
    throw new Error("缺少参数 --app-path");
  }
  if (!outputDir) {
    throw new Error("缺少参数 --output-dir");
  }
  if (!Number.isInteger(remoteDebuggingPort) || remoteDebuggingPort <= 0) {
    throw new Error("--remote-debugging-port 必须为正整数");
  }
  if (!Number.isInteger(taxYear) || taxYear < 1900) {
    throw new Error("--tax-year 必须为大于等于 1900 的整数");
  }
  if (!unitName) {
    throw new Error("--unit-name 不能为空");
  }

  return {
    appPath,
    outputDir,
    remoteDebuggingPort,
    taxYear,
    unitName,
  };
};

const ensureDirectory = async (directoryPath) => {
  await fsp.mkdir(directoryPath, { recursive: true });
};

const writeJsonFile = async (filePath, value) => {
  await ensureDirectory(path.dirname(filePath));
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const findAvailablePort = async (preferredPort) =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      reject(error);
    });
    server.listen(preferredPort, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : preferredPort;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });

const requestJson = async (baseUrl, requestPath, init = {}) => {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(json?.message ?? `${init.method ?? "GET"} ${requestPath} 失败`);
  }

  return json;
};

const waitFor = async (label, predicate, timeoutMs = 30_000, intervalMs = 250) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await predicate();
    if (result) {
      return result;
    }
    await sleep(intervalMs);
  }

  throw new Error(`${label} 超时`);
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
};

const buildCsvLine = (values) => values.map((value) => escapeCsvValue(value)).join(",");

const buildEmployeeCsv = () => {
  const employees = [
    {
      employeeCode: "E2E-001",
      employeeName: "发布前验证员工一",
      idNumber: "110101199001010011",
      hireDate: "2026-01-01",
      leaveDate: "",
      remark: "发布前E2E",
    },
    {
      employeeCode: "E2E-002",
      employeeName: "发布前验证员工二",
      idNumber: "110101199001010022",
      hireDate: "2026-01-01",
      leaveDate: "",
      remark: "发布前E2E",
    },
  ];

  const lines = [
    buildCsvLine(EMPLOYEE_HEADERS),
    ...employees.map((employee) =>
      buildCsvLine([
        employee.employeeCode,
        employee.employeeName,
        employee.idNumber,
        employee.hireDate,
        employee.leaveDate,
        employee.remark,
      ]),
    ),
  ];

  return {
    employees,
    csvText: `${lines.join("\n")}\n`,
  };
};

const buildMonthRecordCsv = (employees, taxYear) => {
  const lines = [buildCsvLine(MONTH_RECORD_HEADERS)];

  employees.forEach((employee, employeeIndex) => {
    for (let taxMonth = 1; taxMonth <= 12; taxMonth += 1) {
      const salaryIncome = 12_000 + employeeIndex * 600 + taxMonth * 20;
      const annualBonus = taxMonth === 1 ? 18_000 + employeeIndex * 2_000 : 0;
      const withheldTax = 320 + employeeIndex * 30;
      lines.push(
        buildCsvLine([
          employee.employeeCode,
          taxYear,
          taxMonth,
          salaryIncome,
          annualBonus,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          withheldTax,
          0,
          "",
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          "",
        ]),
      );
    }
  });

  return `${lines.join("\n")}\n`;
};

const createLogStream = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return fs.createWriteStream(filePath, { flags: "a" });
};

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.openPromise = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", () => resolve());
      this.socket.addEventListener("error", (event) => {
        reject(event.error ?? new Error("CDP 连接失败"));
      });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        return;
      }

      const handler = this.pending.get(message.id);
      if (!handler) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        handler.reject(new Error(message.error.message ?? "CDP 命令失败"));
        return;
      }

      handler.resolve(message.result ?? {});
    });
  }

  async ready() {
    await this.openPromise;
  }

  async send(method, params = {}) {
    await this.ready();
    const id = this.nextId++;
    const payload = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  async close() {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      await sleep(100);
    }
  }
}

const pageEval = async (client, fn, args = {}) => {
  const expression = `(${fn.toString()})(${JSON.stringify(args)})`;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "页面脚本执行失败");
  }

  return result.result?.value;
};

const saveScreenshot = async (client, filePath) => {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  await ensureDirectory(path.dirname(filePath));
  await fsp.writeFile(filePath, Buffer.from(screenshot.data, "base64"));
};

const waitForHeading = async (client, heading, timeoutMs = 20_000) =>
  waitFor(
    `页面标题 ${heading}`,
    () =>
      pageEval(
        client,
        ({ expectedHeading }) => {
          const title = document.querySelector("h1");
          return title && title.textContent?.includes(expectedHeading) ? title.textContent : null;
        },
        { expectedHeading: heading },
      ),
    timeoutMs,
  );

const waitForText = async (client, text, timeoutMs = 20_000) =>
  waitFor(
    `文本 ${text}`,
    () =>
      pageEval(
        client,
        ({ expectedText }) => document.body?.innerText.includes(expectedText) || false,
        { expectedText: text },
      ),
    timeoutMs,
  );

const clickByText = async (client, text, selector = "button, a") => {
  const clicked = await pageEval(
    client,
    ({ expectedText, targetSelector }) => {
      const normalize = (value) => value.replace(/\s+/g, " ").trim();
      const isVisible = (element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        return style.visibility !== "hidden" && style.display !== "none";
      };
      const target = Array.from(document.querySelectorAll(targetSelector)).find((element) => {
        if (!(element instanceof HTMLElement) || !isVisible(element)) {
          return false;
        }

        return normalize(element.innerText || element.textContent || "").includes(expectedText);
      });

      if (!(target instanceof HTMLElement)) {
        return false;
      }

      target.click();
      return true;
    },
    { expectedText: text, targetSelector: selector },
  );

  if (!clicked) {
    throw new Error(`未找到可点击元素：${text}`);
  }
};

const fillLabeledControl = async (client, labelText, value) => {
  const filled = await pageEval(
    client,
    ({ expectedLabel, nextValue }) => {
      const normalize = (value) => value.replace(/\s+/g, " ").trim();
      const field = Array.from(document.querySelectorAll("label.form-field")).find((element) => {
        const labelNode = element.querySelector("span");
        return labelNode && normalize(labelNode.textContent || "") === expectedLabel;
      });

      if (!(field instanceof HTMLElement)) {
        return false;
      }

      const input =
        field.querySelector("input, textarea, select") ??
        field.parentElement?.querySelector("input, textarea, select");
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
        return false;
      }

      input.focus();
      const valueSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input),
        "value",
      )?.set;
      if (valueSetter) {
        valueSetter.call(input, String(nextValue));
      } else {
        input.value = String(nextValue);
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { expectedLabel: labelText, nextValue: value },
  );

  if (!filled) {
    throw new Error(`未找到字段：${labelText}`);
  }
};

const waitForBanner = async (client, { successIncludes = [], timeoutMs = 20_000 }) =>
  waitFor(
    "页面反馈横幅",
    () =>
      pageEval(
        client,
        ({ expectedSuccessTexts }) => {
          const normalize = (value) => value.replace(/\s+/g, " ").trim();
          const successMessages = Array.from(document.querySelectorAll(".success-banner"))
            .map((element) => normalize(element.textContent || ""))
            .filter(Boolean);
          const errorMessages = Array.from(document.querySelectorAll(".error-banner"))
            .map((element) => normalize(element.textContent || ""))
            .filter(Boolean);

          const matchedSuccess = successMessages.find((message) =>
            expectedSuccessTexts.some((expectedText) => message.includes(expectedText)),
          );
          if (matchedSuccess) {
            return {
              status: "success",
              message: matchedSuccess,
            };
          }

          if (errorMessages.length) {
            return {
              status: "error",
              message: errorMessages[0],
            };
          }

          return null;
        },
        { expectedSuccessTexts: successIncludes },
      ),
    timeoutMs,
  );

const getMonthEntryState = (client) =>
  pageEval(client, () => {
    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    const summaryCards = Array.from(document.querySelectorAll(".summary-card"));
    const summary = Object.fromEntries(
      summaryCards.map((card) => {
        const label = card.querySelector("span")?.textContent ?? "";
        const value = card.querySelector("strong")?.textContent ?? "";
        return [normalize(label), normalize(value)];
      }),
    );

    const calculateButton = Array.from(document.querySelectorAll("button")).find((button) =>
      normalize(button.textContent || "").includes("执行计算"),
    );

    return {
      summary,
      calculateButtonDisabled: calculateButton instanceof HTMLButtonElement ? calculateButton.disabled : null,
      errorMessages: Array.from(document.querySelectorAll(".error-banner")).map((element) =>
        normalize(element.textContent || ""),
      ),
    };
  });

const getResultConfirmationState = (client) =>
  pageEval(client, () => {
    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    const rowTexts = Array.from(document.querySelectorAll(".data-table tbody tr")).map((row) =>
      normalize(row.textContent || ""),
    );

    const confirmButton = Array.from(document.querySelectorAll("button")).find((button) =>
      normalize(button.textContent || "").includes("确认当前月份"),
    );

    return {
      rowTexts: rowTexts.filter(Boolean),
      confirmButtonDisabled: confirmButton instanceof HTMLButtonElement ? confirmButton.disabled : null,
      errorMessages: Array.from(document.querySelectorAll(".error-banner")).map((element) =>
        normalize(element.textContent || ""),
      ),
    };
  });

const getHistoryQueryState = (client) =>
  pageEval(client, () => {
    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    const rows = Array.from(
      document.querySelectorAll(".data-table tbody tr"),
    ).map((row) => normalize(row.textContent || ""));
    const unitSelect = Array.from(document.querySelectorAll("label.form-field")).find((element) =>
      normalize(element.querySelector("span")?.textContent || "") === "单位",
    )?.querySelector("select");
    const yearSelect = Array.from(document.querySelectorAll("label.form-field")).find((element) =>
      normalize(element.querySelector("span")?.textContent || "") === "年份",
    )?.querySelector("select");

    return {
      rowTexts: rows.filter(Boolean),
      errorMessages: Array.from(document.querySelectorAll(".error-banner")).map((element) =>
        normalize(element.textContent || ""),
      ),
      unitValue: unitSelect instanceof HTMLSelectElement ? unitSelect.value : null,
      unitLabel:
        unitSelect instanceof HTMLSelectElement
          ? normalize(unitSelect.selectedOptions[0]?.textContent || "")
          : null,
      yearValue: yearSelect instanceof HTMLSelectElement ? yearSelect.value : null,
      yearLabel:
        yearSelect instanceof HTMLSelectElement
          ? normalize(yearSelect.selectedOptions[0]?.textContent || "")
          : null,
    };
  });

const getPolicyPageState = (client) =>
  pageEval(client, () => {
    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    const headerTagText = normalize(
      document.querySelector(".page-grid .placeholder-card .tag")?.textContent || "",
    );

    return {
      headerTagText,
      illustrationButtonCount: document.querySelectorAll(".policy-illustration-button").length,
      hasEmptyPolicyState: document.body.innerText.includes("当前还没有维护扣除项说明。"),
    };
  });

const connectToPageTarget = async (port) => {
  const target = await waitFor(
    "Electron page target",
    async () => {
      let response;
      try {
        response = await fetch(`http://127.0.0.1:${port}/json/list`);
      } catch {
        return null;
      }
      if (!response.ok) {
        return null;
      }

      const targets = await response.json();
      return (
        targets.find(
          (item) => item.type === "page" && (item.url.startsWith("file://") || item.url.startsWith("http")),
        ) ?? null
      );
    },
    20_000,
    250,
  );

  return target;
};

const seedImportData = async (apiBaseUrl, unitId, taxYear, outputDir) => {
  const employeeSeed = buildEmployeeCsv();
  const employeeCsvPath = path.join(outputDir, "employees.csv");
  await fsp.writeFile(employeeCsvPath, employeeSeed.csvText, "utf8");

  const employeePreview = await requestJson(apiBaseUrl, "/api/import/preview", {
    method: "POST",
    body: JSON.stringify({
      importType: "employee",
      unitId,
      csvText: employeeSeed.csvText,
    }),
  });
  const employeeCommit = await requestJson(apiBaseUrl, "/api/import/commit", {
    method: "POST",
    body: JSON.stringify({
      importType: "employee",
      unitId,
      csvText: employeeSeed.csvText,
      conflictStrategy: "overwrite",
    }),
  });
  const employees = await requestJson(apiBaseUrl, `/api/units/${unitId}/employees`);

  const monthCsvText = buildMonthRecordCsv(employees, taxYear);
  const monthCsvPath = path.join(outputDir, "month-records.csv");
  await fsp.writeFile(monthCsvPath, monthCsvText, "utf8");

  const monthPreview = await requestJson(apiBaseUrl, "/api/import/preview", {
    method: "POST",
    body: JSON.stringify({
      importType: "month_record",
      unitId,
      scopeTaxYear: taxYear,
      csvText: monthCsvText,
    }),
  });
  const monthCommit = await requestJson(apiBaseUrl, "/api/import/commit", {
    method: "POST",
    body: JSON.stringify({
      importType: "month_record",
      unitId,
      scopeTaxYear: taxYear,
      csvText: monthCsvText,
      conflictStrategy: "overwrite",
    }),
  });

  return {
    employeeCsvPath,
    monthCsvPath,
    employees,
    employeePreview,
    employeeCommit,
    monthPreview,
    monthCommit,
  };
};

const cleanupProcess = async (childProcess) => {
  if (!childProcess || childProcess.killed) {
    return;
  }

  try {
    await execFileAsync("taskkill", ["/PID", String(childProcess.pid), "/T", "/F"]);
  } catch {
    childProcess.kill();
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.appPath)) {
    throw new Error(`找不到发布包可执行文件：${args.appPath}`);
  }

  await ensureDirectory(args.outputDir);
  const tempRoot = path.join(os.tmpdir(), `dude-tax-release-preflight-${randomUUID()}`);
  const userDataDir = path.join(tempRoot, "profile");
  await ensureDirectory(userDataDir);

  const port = await findAvailablePort(args.remoteDebuggingPort);
  const stdoutPath = path.join(tempRoot, "electron-stdout.log");
  const stderrPath = path.join(tempRoot, "electron-stderr.log");
  const stdoutStream = createLogStream(stdoutPath);
  const stderrStream = createLogStream(stderrPath);

  const steps = [];
  const issues = [];
  const screenshots = {};
  let childProcess = null;
  let client = null;

  try {
    childProcess = spawn(
      args.appPath,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
      {
        cwd: path.dirname(args.appPath),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    childProcess.stdout?.pipe(stdoutStream);
    childProcess.stderr?.pipe(stderrStream);

    const pageTarget = await connectToPageTarget(port);
    client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await waitFor(
      "页面初始化",
      () =>
        pageEval(
          client,
          () =>
            Boolean(
              document.readyState === "complete" &&
                window.salaryTaxDesktop?.runtimeConfig?.apiBaseUrl,
            ),
        ),
      20_000,
    );

    const runtimeConfig = await pageEval(client, () => window.salaryTaxDesktop.runtimeConfig);
    if (!runtimeConfig.managedApi) {
      throw new Error("发布包未进入 managed API 模式");
    }

    await requestJson(runtimeConfig.apiBaseUrl, "/api/health");
    steps.push({
      step: "package-start",
      ok: true,
      targetUrl: pageTarget.url,
      runtimeConfig,
    });

    const homeScreenshot = path.join(args.outputDir, "01-home.png");
    await saveScreenshot(client, homeScreenshot);
    screenshots.home = homeScreenshot;

    await clickByText(client, "单位管理", "a");
    await waitForHeading(client, "单位管理");
    await fillLabeledControl(client, "单位名称", args.unitName);
    await fillLabeledControl(client, "备注", "发布前 E2E");
    await fillLabeledControl(client, "起始年份", args.taxYear);
    await clickByText(client, "新增单位");
    await waitForText(client, `已创建单位“${args.unitName}”`);
    await fillLabeledControl(client, "新增年份", args.taxYear + 1);
    await clickByText(client, "新增年份");
    await waitForText(client, `已为“${args.unitName}”新增 ${args.taxYear + 1} 年。`);

    const contextState = await requestJson(runtimeConfig.apiBaseUrl, "/api/context");
    const currentUnit = contextState.units.find((unit) => unit.id === contextState.currentUnitId);
    if (!currentUnit || currentUnit.unitName !== args.unitName) {
      throw new Error("UI 新增单位后，上下文未切换到目标单位");
    }

    const unitScreenshot = path.join(args.outputDir, "02-unit-management.png");
    await saveScreenshot(client, unitScreenshot);
    screenshots.unitManagement = unitScreenshot;
    steps.push({
      step: "unit-management-create",
      ok: true,
      unitId: currentUnit.id,
      unitName: currentUnit.unitName,
      currentTaxYear: contextState.currentTaxYear,
      availableTaxYears: currentUnit.availableTaxYears,
    });

    const importSeed = await seedImportData(
      runtimeConfig.apiBaseUrl,
      currentUnit.id,
      args.taxYear,
      args.outputDir,
    );
    steps.push({
      step: "seed-import-data",
      ok: true,
      employeeCount: importSeed.employees.length,
      employeePreviewRows: importSeed.employeePreview.totalRows,
      monthPreviewRows: importSeed.monthPreview.totalRows,
    });

    await clickByText(client, "员工信息", "a");
    await waitForHeading(client, "员工信息");
    await waitForText(client, "E2E-001");
    const employeeScreenshot = path.join(args.outputDir, "03-employees.png");
    await saveScreenshot(client, employeeScreenshot);
    screenshots.employees = employeeScreenshot;
    steps.push({
      step: "employee-page-readback",
      ok: true,
      employeeCode: "E2E-001",
    });

    await clickByText(client, "月度数据录入", "a");
    await waitForHeading(client, "月度数据录入");
    await waitForText(client, "全部有效员工");
    await waitForText(client, "E2E-001");
    const monthEntryState = await getMonthEntryState(client);
    if (monthEntryState.calculateButtonDisabled) {
      throw new Error(
        `执行计算按钮被禁用：${JSON.stringify(monthEntryState, null, 2)}`,
      );
    }
    await clickByText(client, "执行计算");
    const calculateBanner = await waitForBanner(client, {
      successIncludes: ["年度录入计算已完成"],
    });
    if (calculateBanner.status !== "success") {
      throw new Error(`执行计算失败：${calculateBanner.message}`);
    }
    await waitForText(client, "E2E-001");
    const entryScreenshot = path.join(args.outputDir, "04-entry.png");
    await saveScreenshot(client, entryScreenshot);
    screenshots.entry = entryScreenshot;
    steps.push({
      step: "entry-calculate",
      ok: true,
    });

    await clickByText(client, "缴纳确认", "a");
    await waitForHeading(client, "已纳税月份确认");
    const resultConfirmationState = await waitFor(
      "缴纳确认数据加载",
      async () => {
        const state = await getResultConfirmationState(client);
        return state.rowTexts.some((rowText) => rowText.includes("E2E-001")) ? state : null;
      },
      20_000,
    );
    if (resultConfirmationState.confirmButtonDisabled) {
      throw new Error(
        `确认当前月份按钮被禁用：${JSON.stringify(resultConfirmationState, null, 2)}`,
      );
    }
    await clickByText(client, "确认当前月份");
    await waitForText(client, "已确认 1 月数据。");
    const resultScreenshot = path.join(args.outputDir, "05-result-confirmation.png");
    await saveScreenshot(client, resultScreenshot);
    screenshots.resultConfirmation = resultScreenshot;
    steps.push({
      step: "result-confirmation",
      ok: true,
      confirmedMonth: 1,
    });

    await clickByText(client, "历史查询", "a");
    await waitForHeading(client, "历史查询");
    await fillLabeledControl(client, "单位", currentUnit.id);
    await fillLabeledControl(client, "年份", args.taxYear);
    await sleep(100);
    const historyQueryStateBefore = await getHistoryQueryState(client);
    await clickByText(client, "查询", "button");
    const historyQueryState = await waitFor(
      "历史查询结果加载",
      async () => {
        const state = await getHistoryQueryState(client);
        const rowsChanged =
          JSON.stringify(state.rowTexts) !== JSON.stringify(historyQueryStateBefore.rowTexts);
        return state.errorMessages.length || rowsChanged ? state : null;
      },
      20_000,
    );
    if (historyQueryState.errorMessages.length) {
      throw new Error(`历史查询失败：${historyQueryState.errorMessages[0]}`);
    }
    if (!historyQueryState.rowTexts.some((rowText) => rowText.includes("E2E-001"))) {
      throw new Error(`历史查询未命中预期员工：${JSON.stringify(historyQueryState, null, 2)}`);
    }
    const historyScreenshot = path.join(args.outputDir, "06-history.png");
    await saveScreenshot(client, historyScreenshot);
    screenshots.history = historyScreenshot;
    steps.push({
      step: "history-query",
      ok: true,
      employeeCode: "E2E-001",
    });

    await clickByText(client, "政策参考", "a");
    await waitForHeading(client, "政策参考");
    const policyPageState = await waitFor(
      "政策参考数据加载",
      async () => {
        const state = await getPolicyPageState(client);
        return state.headerTagText !== "加载中" ? state : null;
      },
      20_000,
    );
    if (policyPageState.illustrationButtonCount === 0) {
      throw new Error(`政策参考插图未加载：${JSON.stringify(policyPageState, null, 2)}`);
    }
    const openedIllustration = await pageEval(client, () => {
      const button = document.querySelector(".policy-illustration-button");
      if (!(button instanceof HTMLButtonElement)) {
        return false;
      }

      button.click();
      return true;
    });
    await waitForText(client, "原图预览");
    const policyScreenshot = path.join(args.outputDir, "07-policy.png");
    await saveScreenshot(client, policyScreenshot);
    screenshots.policy = policyScreenshot;
    steps.push({
      step: "policy-reference",
      ok: true,
      openedIllustration,
    });

    await clickByText(client, "系统维护", "a");
    await waitForText(client, "税率维护");
    await waitForText(client, "审计日志");
    const maintenanceScreenshot = path.join(args.outputDir, "08-maintenance.png");
    await saveScreenshot(client, maintenanceScreenshot);
    screenshots.maintenance = maintenanceScreenshot;
    steps.push({
      step: "maintenance-render",
      ok: true,
      currentVersionName: await pageEval(
        client,
        () => {
          const versionCards = Array.from(document.querySelectorAll(".maintenance-note-card"));
          const matchedCard = versionCards.find((card) =>
            card.textContent?.includes("当前生效"),
          );
          return matchedCard?.querySelector("strong")?.textContent?.trim() ?? null;
        },
      ),
    });

    const databaseExists = fs.existsSync(runtimeConfig.databasePath);
    if (!databaseExists) {
      issues.push({
        priority: "P1",
        title: "managed API 数据库未落盘",
        detail: `未找到数据库文件：${runtimeConfig.databasePath}`,
      });
    }

    const summary = {
      status: issues.length ? "warning" : "success",
      data: {
        args,
        port,
        tempRoot,
        steps,
        issues,
        artifacts: {
          ...screenshots,
          electronStdoutPath: stdoutPath,
          electronStderrPath: stderrPath,
          employeeCsvPath: importSeed.employeeCsvPath,
          monthCsvPath: importSeed.monthCsvPath,
        },
      },
      error: null,
    };
    await writeJsonFile(path.join(args.outputDir, "summary.json"), summary);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await client?.close().catch(() => {});
    await cleanupProcess(childProcess);
    stdoutStream.end();
    stderrStream.end();
  }
};

try {
  await main();
} catch (error) {
  const failure = {
    status: "error",
    data: null,
    error: error instanceof Error ? error.message : "未知错误",
  };
  process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
