import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = "docs/oam/dormitory-13-scenario-production-usable-closure-report.md";
const failures = [];
const report = readIfExists(reportPath);

if (!report) {
  fail(`missing report: ${reportPath}`);
} else {
  for (const section of [
    "## 0. 当前结论",
    "## 1. 现有架构资产表",
    "## 2. 15 个投产职责域消费闭环矩阵",
    "## 3. 旧链退役矩阵与保留理由",
    "## 4. 13 场景业务可用性重核",
    "## 5. 真实浏览器验收设计与实际证据",
    "## 6. 性能与可恢复性结果",
    "## 7. 用户亲测包",
    "## 8. 最终复验脚本",
    "## 9. 未关闭边界"
  ]) {
    if (!report.includes(section)) fail(`missing section: ${section}`);
  }

  for (const scenarioName of [
    "房源建档与基础就绪",
    "房源运营就绪与状态维护",
    "住宿商品与价格",
    "询价与报价",
    "预订与库存锁定",
    "收款、押金与担保",
    "入住办理",
    "在住管理",
    "退房结算",
    "取消、未到店与退款处理",
    "房务、维修与停售协同",
    "渠道与企业客户",
    "经营报表、审计与复盘"
  ]) {
    if (!report.includes(scenarioName)) fail(`missing scenario name: ${scenarioName}`);
  }

  for (const gate of [
    "check-current-oam",
    "check-generated-files-not-manually-edited",
    "check-dormitory-13-scenario-control-authority",
    "check-dormitory-13-scenario-consumption-boundary",
    "run-dormitory-real-browser-audits",
    "check-current-evidence-root",
    "check-dormitory-mainline-activation-transaction"
  ]) {
    if (!report.includes(gate)) fail(`missing final verification gate: ${gate}`);
  }

  for (const boundary of [
    "productionConfirmAllowed=false",
    "businessGoLiveAllowed=false",
    "releaseAuthority=false",
    "finalGoNoGo=NO_GO",
    "不声明生产发布、业务上线或 final GO"
  ]) {
    if (!report.includes(boundary)) fail(`missing NO_GO boundary: ${boundary}`);
  }

  for (const oldChainIdentity of ["旧第一主链", "旧住宿资源种子", "旧资源可用性", "旧销售线索预订"]) {
    if (!report.includes(oldChainIdentity)) fail(`missing old-chain retirement reference: ${oldChainIdentity}`);
  }
}

if (failures.length) {
  console.error("Dormitory production usable closure report check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory production usable closure report check: PASS");

function readIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "") : "";
}

function fail(message) {
  failures.push(message);
}
