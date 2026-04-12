import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiClient } from "./client";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

const installWindowMock = () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        origin: "file://",
        search: "",
      },
      salaryTaxDesktop: {
        runtimeConfig: {
          apiBaseUrl: "http://127.0.0.1:3001",
        },
      },
    },
  });
};

const getHeaderValue = (init: RequestInit | undefined, name: string) => {
  return new Headers(init?.headers).get(name);
};

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: originalFetch,
  });
});

test("有 body 的请求仍会自动附带 JSON Content-Type", async () => {
  installWindowMock();

  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return {
        ok: true,
        json: async () => ({
          id: 1,
          unitName: "测试单位",
          remark: "",
          isArchived: false,
          createdAt: "2026-04-08T00:00:00.000Z",
          updatedAt: "2026-04-08T00:00:00.000Z",
        }),
      } as Response;
    },
  });

  await apiClient.createUnit({
    unitName: "测试单位",
    remark: "",
    startYear: 2026,
  });

  assert.equal(requests.length, 1);
  assert.equal(String(requests[0]?.input), "http://127.0.0.1:3001/api/units");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(getHeaderValue(requests[0]?.init, "Content-Type"), "application/json");
  assert.equal(typeof requests[0]?.init?.body, "string");
});

test("无 body 的 POST 和 DELETE 不再发送 JSON Content-Type", async () => {
  installWindowMock();

  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const responseQueue = [
    {
      challengeId: "11111111-1111-4111-8111-111111111111",
      confirmationCode: "ABC123",
      expiresAt: "2026-04-08T16:00:00.000Z",
    },
    { success: true },
  ];

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return {
        ok: true,
        json: async () => responseQueue.shift(),
      } as Response;
    },
  });

  await apiClient.createDeleteChallenge(1);
  await apiClient.deleteEmployee(2);

  assert.equal(requests.length, 2);
  assert.equal(String(requests[0]?.input), "http://127.0.0.1:3001/api/units/1/delete-challenge");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(getHeaderValue(requests[0]?.init, "Content-Type"), null);
  assert.equal(requests[0]?.init?.body, undefined);

  assert.equal(String(requests[1]?.input), "http://127.0.0.1:3001/api/employees/2");
  assert.equal(requests[1]?.init?.method, "DELETE");
  assert.equal(getHeaderValue(requests[1]?.init, "Content-Type"), null);
  assert.equal(requests[1]?.init?.body, undefined);
});

test("桌面桥接缺失时会回退到窗口查询参数中的本地 API 地址", async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        origin: "file://",
        search: "?salaryTaxApiBaseUrl=http%3A%2F%2F127.0.0.1%3A3217",
      },
    },
  });

  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return {
        ok: true,
        json: async () => [],
      } as Response;
    },
  });

  await apiClient.listUnits();

  assert.equal(requests.length, 1);
  assert.equal(String(requests[0]?.input), "http://127.0.0.1:3217/api/units");
});

test("单位备份相关接口按约定请求草稿与执行备份", async () => {
  installWindowMock();

  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const responseQueue = [
    {
      unitId: 3,
      unitName: "测试单位",
      includedTaxYears: [2026],
      lastDirectoryPath: "C:\\backup",
      suggestedFileName: "测试单位_20260410_120000.zip",
    },
    {
      status: "success",
      filePath: "C:\\backup\\测试单位_20260410_120000.zip",
      exportedAt: "2026-04-10T12:00:00.000Z",
      summaryCounts: {
        units: 1,
      },
    },
  ];

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return {
        ok: true,
        json: async () => responseQueue.shift(),
      } as Response;
    },
  });

  await apiClient.getUnitBackupDraft(3);
  await apiClient.createUnitBackup(3, {
    targetPath: "C:\\backup\\测试单位_20260410_120000.zip",
  });

  assert.equal(requests.length, 2);
  assert.equal(String(requests[0]?.input), "http://127.0.0.1:3001/api/units/3/backup-draft");
  assert.equal(requests[0]?.init?.method, undefined);

  assert.equal(String(requests[1]?.input), "http://127.0.0.1:3001/api/units/3/backup");
  assert.equal(requests[1]?.init?.method, "POST");
  assert.equal(getHeaderValue(requests[1]?.init, "Content-Type"), "application/json");
  assert.equal(
    requests[1]?.init?.body,
    JSON.stringify({
      targetPath: "C:\\backup\\测试单位_20260410_120000.zip",
    }),
  );
});
