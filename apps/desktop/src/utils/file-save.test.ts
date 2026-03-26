import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { saveFileWithDesktopFallback } from "./file-save";

type AnchorMock = {
  href: string;
  download: string;
  click: () => void;
  remove: () => void;
};

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalUrl = globalThis.URL;
const originalBtoa = globalThis.btoa;

const installBrowserMocks = () => {
  let clickCount = 0;
  const anchor: AnchorMock = {
    href: "",
    download: "",
    click: () => {
      clickCount += 1;
    },
    remove: () => undefined,
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: {
        append: () => undefined,
      },
      createElement: () => anchor,
    },
  });

  Object.defineProperty(globalThis, "URL", {
    configurable: true,
    value: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => undefined,
    },
  });

  Object.defineProperty(globalThis, "btoa", {
    configurable: true,
    value: (value: string) => Buffer.from(value, "binary").toString("base64"),
  });

  return {
    anchor,
    getClickCount: () => clickCount,
  };
};

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  });
  Object.defineProperty(globalThis, "URL", {
    configurable: true,
    value: originalUrl,
  });
  Object.defineProperty(globalThis, "btoa", {
    configurable: true,
    value: originalBtoa,
  });
});

test("桌面端取消保存时不应回退为浏览器下载", async () => {
  const browser = installBrowserMocks();
  let saveCallCount = 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      salaryTaxDesktop: {
        saveFile: async () => {
          saveCallCount += 1;
          return { canceled: true } as const;
        },
      },
    },
  });

  const result = await saveFileWithDesktopFallback({
    defaultPath: "测试.csv",
    filters: [{ name: "CSV 文件", extensions: ["csv"] }],
    mimeType: "text/csv;charset=utf-8;",
    content: "a,b,c",
  });

  assert.equal(saveCallCount, 1);
  assert.equal(result.canceled, true);
  assert.equal(browser.getClickCount(), 0);
});

test("无桌面桥接时应回退为浏览器下载", async () => {
  const browser = installBrowserMocks();

  const result = await saveFileWithDesktopFallback({
    defaultPath: "测试.csv",
    filters: [{ name: "CSV 文件", extensions: ["csv"] }],
    mimeType: "text/csv;charset=utf-8;",
    content: "a,b,c",
  });

  assert.equal(result.canceled, false);
  assert.equal(browser.anchor.download, "测试.csv");
  assert.equal(browser.anchor.href, "blob:test");
  assert.equal(browser.getClickCount(), 1);
});
