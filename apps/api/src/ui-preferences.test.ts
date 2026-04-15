import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";

const testDatabasePath = path.join(process.cwd(), "data", "test", "ui-preferences.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/ui-preferences.js"),
  import("./db/database.js"),
]);

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM app_preferences
    WHERE key = 'ui_sidebar_collapsed'
      OR key = 'ui_nav_order'
      OR key LIKE 'ui_layout::%'
      OR key LIKE 'ui_dialog::%';
  `);
});

after(async () => {
  const [, { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("侧边栏偏好支持读写", async () => {
  const [{ registerUiPreferenceRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUiPreferenceRoutes(app);

  const initialResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/sidebar",
  });

  assert.equal(initialResponse.statusCode, 200);
  assert.deepEqual(initialResponse.json(), { collapsed: false });

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/ui-preferences/sidebar",
    payload: { collapsed: true },
  });

  assert.equal(saveResponse.statusCode, 200);
  assert.deepEqual(saveResponse.json(), { collapsed: true });

  const reloadResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/sidebar",
  });

  assert.equal(reloadResponse.statusCode, 200);
  assert.deepEqual(reloadResponse.json(), { collapsed: true });

  await app.close();
});

test("页面布局偏好按 scope 保存、读取与重置", async () => {
  const [{ registerUiPreferenceRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUiPreferenceRoutes(app);

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/ui-preferences/layouts/page:home",
    payload: {
      collapsedSections: {
        "home-overview": true,
      },
      cards: [
        {
          cardId: "home-overview",
          canvasId: "root",
          x: 0.04,
          y: 0.05,
          w: 6.06,
          h: 10.04,
          z: 2,
        },
      ],
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  assert.deepEqual(saveResponse.json(), {
    scope: "page:home",
    collapsedSections: {
      "home-overview": true,
    },
    cards: [
      {
        cardId: "home-overview",
        canvasId: "root",
        x: 0,
        y: 0.1,
        w: 6.1,
        h: 10,
        z: 2,
      },
    ],
  });

  const reloadResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/layouts/page:home",
  });

  assert.equal(reloadResponse.statusCode, 200);
  assert.deepEqual(reloadResponse.json(), {
    scope: "page:home",
    collapsedSections: {
      "home-overview": true,
    },
    cards: [
      {
        cardId: "home-overview",
        canvasId: "root",
        x: 0,
        y: 0.1,
        w: 6.1,
        h: 10,
        z: 2,
      },
    ],
  });

  const resetResponse = await app.inject({
    method: "DELETE",
    url: "/api/ui-preferences/layouts/page:home",
  });

  assert.equal(resetResponse.statusCode, 200);
  assert.deepEqual(resetResponse.json(), {
    scope: "page:home",
    collapsedSections: {
      "home-tax-table": false,
    },
    cards: [
      {
        cardId: "home-policy",
        canvasId: "root",
        x: 0,
        y: 0,
        w: 6,
        h: 6.3,
        z: 0,
      },
      {
        cardId: "home-overview",
        canvasId: "root",
        x: 6,
        y: 0,
        w: 6,
        h: 6.3,
        z: 1,
      },
      {
        cardId: "home-tax-table",
        canvasId: "root",
        x: 0,
        y: 6.3,
        w: 12,
        h: 10.6,
        z: 2,
      },
    ],
  });

  const resetReloadResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/layouts/page:home",
  });

  assert.equal(resetReloadResponse.statusCode, 200);
  assert.deepEqual(resetReloadResponse.json(), {
    scope: "page:home",
    collapsedSections: {
      "home-tax-table": false,
    },
    cards: [
      {
        cardId: "home-policy",
        canvasId: "root",
        x: 0,
        y: 0,
        w: 6,
        h: 6.3,
        z: 0,
      },
      {
        cardId: "home-overview",
        canvasId: "root",
        x: 6,
        y: 0,
        w: 6,
        h: 6.3,
        z: 1,
      },
      {
        cardId: "home-tax-table",
        canvasId: "root",
        x: 0,
        y: 6.3,
        w: 12,
        h: 10.6,
        z: 2,
      },
    ],
  });

  await app.close();
});

test("弹窗布局偏好按 scope 保存、读取与重置", async () => {
  const [{ registerUiPreferenceRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUiPreferenceRoutes(app);

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/ui-preferences/dialogs/dialog:year-record-workspace",
    payload: {
      x: 48,
      y: 32,
      width: 1280,
      height: 860,
      isMaximized: false,
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  assert.deepEqual(saveResponse.json(), {
    scope: "dialog:year-record-workspace",
    x: 48,
    y: 32,
    width: 1280,
    height: 860,
    isMaximized: false,
  });

  const reloadResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/dialogs/dialog:year-record-workspace",
  });

  assert.equal(reloadResponse.statusCode, 200);
  assert.deepEqual(reloadResponse.json(), {
    scope: "dialog:year-record-workspace",
    x: 48,
    y: 32,
    width: 1280,
    height: 860,
    isMaximized: false,
  });

  const resetResponse = await app.inject({
    method: "DELETE",
    url: "/api/ui-preferences/dialogs/dialog:year-record-workspace",
  });

  assert.equal(resetResponse.statusCode, 200);
  assert.deepEqual(resetResponse.json(), { success: true });

  const resetReloadResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/dialogs/dialog:year-record-workspace",
  });

  assert.equal(resetReloadResponse.statusCode, 200);
  assert.equal(resetReloadResponse.json(), null);

  await app.close();
});

test("坏 JSON 会自动回退到默认布局", async () => {
  const [{ registerUiPreferenceRoutes }, { database }] = await modulesPromise;

  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
      `,
    )
    .run("ui_layout::page:history", "{bad json}");

  const app = Fastify({ logger: false });
  await registerUiPreferenceRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/layouts/page:history",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    scope: "page:history",
    collapsedSections: {},
    cards: [],
  });

  await app.close();
});

test("旧整数布局与缺失 z 的历史数据会自动兼容为新布局模型", async () => {
  const [{ registerUiPreferenceRoutes }, { database }] = await modulesPromise;

  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
      `,
    )
    .run(
      "ui_layout::page:entry",
      JSON.stringify({
        scope: "page:entry",
        collapsedSections: {
          "entry-import": true,
        },
        cards: [
          {
            cardId: "entry-overview",
            canvasId: "root",
            x: 0,
            y: 0,
            w: 6,
            h: 10,
          },
          {
            cardId: "entry-import",
            canvasId: "root",
            x: 6,
            y: 0,
            w: 6,
            h: 10,
          },
        ],
      }),
    );

  const app = Fastify({ logger: false });
  await registerUiPreferenceRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/layouts/page:entry",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    scope: "page:entry",
    collapsedSections: {
      "entry-import": true,
    },
    cards: [
      {
        cardId: "entry-overview",
        canvasId: "root",
        x: 0,
        y: 0,
        w: 6,
        h: 10,
        z: 0,
      },
      {
        cardId: "entry-import",
        canvasId: "root",
        x: 6,
        y: 0,
        w: 6,
        h: 10,
        z: 1,
      },
    ],
  });

  await app.close();
});

test("非法 scope 或非法布局数据会被拒绝", async () => {
  const [{ registerUiPreferenceRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUiPreferenceRoutes(app);

  const invalidScopeResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/layouts/page:unknown",
  });

  assert.equal(invalidScopeResponse.statusCode, 400);

  const invalidPayloadResponse = await app.inject({
    method: "PUT",
    url: "/api/ui-preferences/dialogs/dialog:employee-edit",
    payload: {
      x: 20,
      y: 20,
      width: -1,
      height: 400,
      isMaximized: false,
    },
  });

  assert.equal(invalidPayloadResponse.statusCode, 400);

  await app.close();
});

test("导航顺序支持读取默认值、保存新顺序与自动归一化", async () => {
  const [{ registerUiPreferenceRoutes }, { database }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUiPreferenceRoutes(app);

  const initialResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/navigation-order",
  });

  assert.equal(initialResponse.statusCode, 200);
  assert.deepEqual(initialResponse.json(), {
    order: [
      "/",
      "/units",
      "/employees",
      "/quick-calc",
      "/entry",
      "/result-confirmation",
      "/history",
      "/policy",
      "/maintenance",
    ],
  });

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/ui-preferences/navigation-order",
    payload: {
      order: ["/", "/employees", "/units", "/quick-calc", "/entry", "/result-confirmation", "/history", "/policy", "/maintenance"],
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  assert.deepEqual(saveResponse.json(), {
    order: ["/", "/employees", "/units", "/quick-calc", "/entry", "/result-confirmation", "/history", "/policy", "/maintenance"],
  });

  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
    )
    .run("ui_nav_order", JSON.stringify(["/unknown", "/history", "/units"]));

  const normalizedResponse = await app.inject({
    method: "GET",
    url: "/api/ui-preferences/navigation-order",
  });

  assert.equal(normalizedResponse.statusCode, 200);
  assert.deepEqual(normalizedResponse.json(), {
    order: [
      "/history",
      "/units",
      "/",
      "/employees",
      "/quick-calc",
      "/entry",
      "/result-confirmation",
      "/policy",
      "/maintenance",
    ],
  });

  await app.close();
});
