import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mapPath = "docs/contracts/database/oam-db-ownership-map.json";
const reportPath = "artifacts/oam/checks/db-ownership-map-result.json";
const allowedModules = new Set(["accommodation", "finance-gate", "identity", "maintenance"]);
const violations = [];

const ownership = readJson(mapPath);
const migrationTables = tablesFromMigrations();
const mappedTables = new Map();

if (ownership.version !== "oam.db-ownership-map.v1" || ownership.status !== "authoritative") {
  fail("db_map_identity_invalid", "数据库归属总图必须声明 oam.db-ownership-map.v1 authoritative。");
}

for (const group of ownership.tableGroups ?? []) {
  for (const field of ["groupId", "module", "factType", "truthOwner", "writeEntry", "allowedReadSides", "testFile", "appendOnly", "ledgerTable", "auditTable", "projectionTable", "protection", "tables"]) {
    if (!(field in group) || group[field] === "") {
      fail("db_group_field_missing", `${group.groupId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  if (!allowedModules.has(group.module)) {
    fail("db_group_module_unknown", `${group.groupId} 使用未知模块 ${group.module}。`);
  }
  requirePath(group.testFile, `${group.groupId} 测试绑定`);
  if ((group.appendOnly || group.ledgerTable || group.auditTable) && !group.protection) {
    fail("db_group_protection_missing", `${group.groupId} 是追加、账务或审计表组，必须声明 protection。`);
  }
  if (group.ledgerTable && !/Money\/Ledger Kernel|append-only ledger/i.test(group.truthOwner + " " + group.writeEntry + " " + group.protection)) {
    fail("db_group_ledger_owner_invalid", `${group.groupId} 账务表组必须绑定 Money/Ledger Kernel 或追加账务策略。`);
  }
  for (const tableRef of group.tables ?? []) {
    for (const field of ["table", "migrationFile"]) {
      if (!tableRef[field]) {
        fail("db_table_field_missing", `${group.groupId} 表登记缺少 ${field}。`);
      }
    }
    if (mappedTables.has(tableRef.table)) {
      fail("db_table_duplicate", `数据库表重复登记：${tableRef.table}`);
    }
    mappedTables.set(tableRef.table, { group, tableRef });
    requirePath(tableRef.migrationFile, `${tableRef.table} 迁移文件`);
    const migrationFile = migrationTables.get(tableRef.table);
    if (!migrationFile) {
      fail("db_table_not_in_migrations", `归属图登记的表不在迁移中：${tableRef.table}`);
    } else if (normalize(migrationFile) !== normalize(tableRef.migrationFile)) {
      fail("db_table_migration_mismatch", `${tableRef.table} 迁移文件不匹配：期望 ${migrationFile}，实际 ${tableRef.migrationFile}`);
    }
  }
}

for (const table of migrationTables.keys()) {
  if (!mappedTables.has(table)) {
    fail("db_table_unowned", `迁移表未登记 owner：${table}`);
  }
}

for (const manifestPath of ownership.moduleManifestRefs ?? []) {
  requirePath(manifestPath, `模块 manifest ${manifestPath}`);
  const manifest = readJson(manifestPath);
  for (const table of manifest.database ?? []) {
    if (!migrationTables.has(table)) {
      fail("manifest_table_missing_in_migration", `${manifest.module} manifest 声明的表不存在于迁移：${table}`);
    }
    if (!mappedTables.has(table)) {
      fail("manifest_table_missing_owner", `${manifest.module} manifest 声明的表缺少 DB owner：${table}`);
    }
  }
}

writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("DB ownership map check: PASS");

function tablesFromMigrations() {
  const result = new Map();
  const dir = "infra/db/migrations";
  for (const file of fs.readdirSync(abs(dir)).filter((item) => item.endsWith(".sql")).sort()) {
    const repoPath = `${dir}/${file}`;
    const text = fs.readFileSync(abs(repoPath), "utf8");
    for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:[a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
      if (!result.has(match[1])) {
        result.set(match[1], repoPath);
      }
    }
  }
  return result;
}

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label) {
  if (!fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeReport() {
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "fail" : "pass",
    violations
  }, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function normalize(file) {
  return String(file).replaceAll("\\", "/");
}

function abs(file) {
  return path.join(root, file);
}
