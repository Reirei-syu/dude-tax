-- Dude Tax initial schema (v1)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  UNIQUE(org_id, year),
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hire_date TEXT,
  leave_date TEXT,
  is_first_time INTEGER DEFAULT 0,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS monthly_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  salary REAL NOT NULL DEFAULT 0,
  social_deduct REAL NOT NULL DEFAULT 0,
  special_addl REAL NOT NULL DEFAULT 0,
  other_deduct REAL NOT NULL DEFAULT 0,
  detail_json TEXT,
  UNIQUE(employee_id, month),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS bonuses (
  employee_id TEXT PRIMARY KEY,
  amount REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS board_layouts (
  workspace_id TEXT PRIMARY KEY,
  nodes_json TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
