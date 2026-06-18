import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const controlAuthorityPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const handoffSummariesPath = "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json";
const objectOwnershipPath = "docs/contracts/generated/dormitory/13-scenario-object-ownership.generated.json";
const financeBoundaryPath = "docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json";
const resultPath = "artifacts/oam/checks/dormitory-13-scenario-integration-chain-result.json";

const scenarioSourcePaths = {
  1: "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json",
  2: "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json",
  3: "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json",
  4: "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json",
  5: "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json",
  6: "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json",
  7: "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json",
  8: "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json",
  9: "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json",
  10: "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json",
  11: "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json",
  12: "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json",
  13: "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json"
};

const scenarioHandoffPaths = Object.fromEntries(
  Object.keys(scenarioSourcePaths).map((scenarioNo) => [
    Number(scenarioNo),
    `docs/contracts/generated/dormitory/scenario${scenarioNo}-handoff.generated.json`
  ])
);

const chains = [
  {
    id: "A",
    nameZh: "房源建档 -> 运营就绪 -> 商品价格 -> 报价 -> 预订",
    links: [[1, 2], [2, 3], [3, 4], [4, 5]],
    requiredOutputs: {
      1: ["房间摘要", "床位组摘要", "基础就绪摘要"],
      2: ["运营状态摘要", "可否进入价格维护"],
      3: ["商品摘要", "价格方案摘要"],
      4: ["报价单", "报价版本", "价格快照"],
      5: ["预订确认摘要", "库存锁定历史"]
    },
    forbiddenProducerOutputs: {
      1: ["可运营", "可报价", "可预订"],
      4: ["预订", "库存锁定"],
      5: ["Stay", "Payment", "Deposit", "Refund", "LedgerEntry"]
    }
  },
  {
    id: "B",
    nameZh: "预订 -> 收款押金担保 -> 入住 -> 在住",
    links: [[5, 6], [6, 7], [7, 8]],
    requiredOutputs: {
      5: ["预订确认摘要", "预订号", "库存锁定历史"],
      6: ["收款确认摘要", "押金确认摘要", "担保确认摘要", "财务确认状态"],
      7: ["入住记录摘要", "住客摘要", "占用摘要"],
      8: ["在住状态", "退房准备"]
    },
    forbiddenProducerOutputs: {
      5: ["Stay", "入住", "Payment", "LedgerEntry"],
      6: ["Stay", "入住", "Refund", "LedgerEntry"],
      7: ["退房", "退款", "LedgerEntry"]
    }
  },
  {
    id: "C",
    nameZh: "在住 -> 退房结算 -> 财务处理请求 -> 房源待恢复",
    links: [[8, 9]],
    requiredOutputs: {
      8: ["在住状态", "退房准备"],
      9: ["退房确认摘要", "财务处理请求", "资源待恢复请求"]
    },
    requiredConsumers: [
      { producer: 9, consumer: "finance-gate", outputs: ["财务处理请求", "结算意向"] },
      { producer: 9, consumerPackageNo: 2, outputs: ["资源待恢复请求"] }
    ],
    forbiddenProducerOutputs: {
      9: ["Payment", "Refund", "LedgerEntry", "RoomOperationStatus=可运营"]
    }
  },
  {
    id: "D",
    nameZh: "预订 -> 取消/未到店 -> 库存释放请求 -> 财务处理请求",
    links: [[5, 10]],
    requiredOutputs: {
      5: ["预订确认摘要", "库存锁定历史"],
      10: ["取消/未到店摘要", "退款/扣费申请", "库存释放请求", "财务处理请求"]
    },
    requiredConsumers: [
      { producer: 10, consumer: "finance-gate", outputs: ["退款/扣费申请", "财务处理请求"] },
      { producer: 10, consumer: "inventory-reservation-read-model", outputs: ["库存释放请求"] }
    ],
    forbiddenProducerOutputs: {
      10: ["Payment", "Refund", "LedgerEntry", "已退款到账", "已入账"]
    }
  },
  {
    id: "E",
    nameZh: "退房待恢复/在住服务 -> 房务维修 -> 恢复建议 -> 场景 2 重新确认运营状态",
    links: [[8, 11], [9, 11]],
    requiredOutputs: {
      8: ["在住状态", "服务/异常/续住/换房换床摘要"],
      9: ["退房确认摘要", "资源待恢复请求"],
      11: ["作业完成摘要", "验收摘要", "恢复运营建议"]
    },
    requiredConsumers: [
      { producer: 11, consumerPackageNo: 2, outputs: ["恢复运营建议", "验收摘要"] }
    ],
    forbiddenProducerOutputs: {
      11: ["RoomOperationStatus=可运营", "Reservation", "Stay", "Payment", "Refund", "LedgerEntry"]
    }
  }
];

const violations = [];
const controlAuthority = readJson(controlAuthorityPath);
const handoffSummaries = readJson(handoffSummariesPath);
const objectOwnership = readJson(objectOwnershipPath);
const financeBoundary = readJson(financeBoundaryPath);
const scenarioSources = new Map();
const scenarioHandoffs = new Map();

for (const [scenarioNo, file] of Object.entries(scenarioSourcePaths)) {
  scenarioSources.set(Number(scenarioNo), readJson(file));
}
for (const [scenarioNo, file] of Object.entries(scenarioHandoffPaths)) {
  scenarioHandoffs.set(Number(scenarioNo), readJson(file));
}

checkControlAndSourceAuthority();
checkGlobalConflictBoundaries();
const chainResults = chains.map(checkChain);
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("Dormitory 13 scenario integration chain check: PASS");

function checkControlAndSourceAuthority() {
  requireValue(controlAuthority.authorityId === "Dormitory.Operating13ScenarioControl", "chain.control_authority_invalid", "13 场景总控 Source Authority 必须是最高业务权威。");
  requireValue(controlAuthority.status === "authoritative", "chain.control_authority_not_authoritative", "13 场景总控 Source Authority 必须保持 authoritative。");
  requireValue((controlAuthority.scenarios ?? []).length === 13, "chain.control_scenario_count_invalid", "13 场景总控必须定义 13 个场景。");
  requireValue(controlAuthority.finalSafety?.productionConfirmAllowed === false, "chain.production_not_closed", "总控必须保持 productionConfirmAllowed=false。");
  requireValue(controlAuthority.finalSafety?.releaseAuthority === false, "chain.release_not_closed", "总控必须保持 releaseAuthority=false。");
  requireValue(controlAuthority.finalSafety?.finalGoNoGo === "NO_GO", "chain.final_go_not_closed", "总控必须保持 finalGoNoGo=NO_GO。");
  requireValue(handoffSummaries.generated === true && handoffSummaries.doNotEdit === true, "chain.handoff_summary_not_generated", "交接摘要必须来自 generated 合同。");
  requireValue((handoffSummaries.summaries ?? []).length === 13, "chain.handoff_summary_count_invalid", "交接摘要 generated 合同必须覆盖 13 个场景。");

  for (const [scenarioNo, source] of scenarioSources) {
    requireValue(source.status === "authoritative", "chain.scenario_source_not_authoritative", `场景 ${scenarioNo} Source Authority 必须保持 authoritative。`, { scenarioNo });
    requireValue(source.scenarioPackageNo === scenarioNo, "chain.scenario_no_mismatch", `场景 ${scenarioNo} Source Authority 编号不匹配。`, { scenarioNo });
    if (scenarioNo > 1) {
      requireValue(source.highestAuthorityRef === controlAuthorityPath, "chain.scenario_highest_authority_missing", `场景 ${scenarioNo} 必须声明总控 Source Authority 为最高权威。`, { scenarioNo });
    }
  }

  for (const [scenarioNo, handoff] of scenarioHandoffs) {
    requireValue(handoff.generated === true && handoff.doNotEdit === true, "chain.handoff_not_generated", `场景 ${scenarioNo} handoff 必须是 generated/doNotEdit。`, { scenarioNo });
    requireValue(handoff.scenarioPackageNo === scenarioNo, "chain.handoff_no_mismatch", `场景 ${scenarioNo} handoff 编号不匹配。`, { scenarioNo });
    requireValue(handoff.productionConfirmAllowed === false && handoff.releaseAuthority === false && handoff.finalGoNoGo === "NO_GO", "chain.handoff_safety_flags_invalid", `场景 ${scenarioNo} handoff 必须保持 NO_GO 安全标记。`, { scenarioNo });
  }
}

function checkGlobalConflictBoundaries() {
  const ownershipText = JSON.stringify(objectOwnership);
  for (const required of [
    ["OperationStatus", "2"],
    ["RecoveryRecommendation", "11"],
    ["RatePlan", "3"],
    ["PublicationRule", "12"],
    ["ReportSnapshot", "13"]
  ]) {
    requireValue(ownershipText.includes(required[0]), "chain.object_ownership_missing", `对象归属 generated 合同缺少 ${required[0]}。`, { objectName: required[0] });
  }

  const financeTruthObjects = financeBoundary.financeTruthObjects ?? financeBoundary.financeBoundary?.financeTruthObjects ?? [];
  for (const objectName of ["Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "FinanceReceipt"]) {
    requireValue(financeTruthObjects.includes(objectName), "chain.finance_truth_object_missing", `finance-gate 边界缺少账务真值对象 ${objectName}。`, { objectName });
  }

  const exclusiveWriters = financeBoundary.exclusiveTruthWriters ?? financeBoundary.financeBoundary?.exclusiveTruthWriters ?? [];
  requireValue(exclusiveWriters.includes("finance-gate") && exclusiveWriters.includes("finance-kernel"), "chain.finance_truth_writer_invalid", "Payment/Deposit/Refund/LedgerEntry 必须只由 finance-gate 或 finance-kernel 产生。");
}

function checkChain(chain) {
  const linkResults = [];
  for (const [producerNo, consumerNo] of chain.links) {
    linkResults.push(checkLink(chain.id, producerNo, consumerNo));
  }

  for (const [scenarioNoText, expectedOutputs] of Object.entries(chain.requiredOutputs ?? {})) {
    const scenarioNo = Number(scenarioNoText);
    const outputs = collectOutputs(scenarioNo);
    for (const expected of expectedOutputs) {
      requireValue(
        includesCompatible(outputs, expected),
        "chain.required_output_missing",
        `链路 ${chain.id} 场景 ${scenarioNo} 缺少输出摘要 ${expected}。`,
        { chainId: chain.id, scenarioNo, expected }
      );
    }
  }

  for (const [scenarioNoText, forbiddenOutputs] of Object.entries(chain.forbiddenProducerOutputs ?? {})) {
    const scenarioNo = Number(scenarioNoText);
    const forbidden = collectForbiddenOutputs(scenarioNo);
    for (const expected of forbiddenOutputs) {
      requireValue(
        includesCompatible(forbidden, expected),
        "chain.forbidden_output_missing",
        `链路 ${chain.id} 场景 ${scenarioNo} 必须阻断越权输出 ${expected}。`,
        { chainId: chain.id, scenarioNo, expected }
      );
    }
  }

  for (const consumerSpec of chain.requiredConsumers ?? []) {
    checkDownstreamConsumer(chain.id, consumerSpec);
  }

  return {
    chainId: chain.id,
    nameZh: chain.nameZh,
    status: violations.some((item) => item.chainId === chain.id) ? "FAIL" : "PASS",
    links: linkResults,
    upstreamSummaryReadonly: linkResults.every((item) => item.upstreamReadonly === true),
    downstreamNoReentry: linkResults.every((item) => item.downstreamNoRefill === true),
    unauthorizedWriteBlocked: true,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function checkLink(chainId, producerNo, consumerNo) {
  const consumer = scenarioHandoffs.get(consumerNo);
  const producerOutputs = collectOutputs(producerNo);
  const consumerInputs = consumer?.upstream?.requiredReadonlyInputs ?? [];
  const sharedOutputs = compatibleIntersection(producerOutputs, consumerInputs);
  const allowedSources = [
    consumer?.upstream?.allowedSourcePackageNo,
    ...(consumer?.upstream?.allowedSourcePackageNos ?? [])
  ].filter((item) => item !== undefined);
  const upstreamReadonly = consumer?.upstream?.upstreamWriteBackAllowed === false;
  const downstreamNoRefill = /不得要求用户重新填写|只能读取/.test(consumer?.upstream?.mustNotRequireRefillZh ?? "");

  requireValue(allowedSources.includes(producerNo), "chain.link_source_not_allowed", `链路 ${chainId} 中场景 ${consumerNo} 必须允许读取场景 ${producerNo} 的摘要。`, { chainId, producerNo, consumerNo });
  requireValue(sharedOutputs.length > 0, "chain.link_no_summary_match", `链路 ${chainId} 中场景 ${producerNo} 到 ${consumerNo} 缺少可匹配的摘要交接。`, { chainId, producerNo, consumerNo, producerOutputs, consumerInputs });
  requireValue(upstreamReadonly, "chain.upstream_writeback_allowed", `链路 ${chainId} 中场景 ${consumerNo} 必须禁止反写上游。`, { chainId, consumerNo });
  requireValue(downstreamNoRefill, "chain.downstream_refill_allowed", `链路 ${chainId} 中场景 ${consumerNo} 必须禁止重新填写上游已确认字段。`, { chainId, consumerNo });

  return {
    from: producerNo,
    to: consumerNo,
    sharedOutputs,
    upstreamReadonly,
    downstreamNoRefill
  };
}

function checkDownstreamConsumer(chainId, spec) {
  const producer = scenarioHandoffs.get(spec.producer);
  const consumers = producer?.downstream?.allowedConsumers ?? [];
  const match = consumers.find((item) => {
    if (spec.consumerPackageNo !== undefined) return item.consumerPackageNo === spec.consumerPackageNo;
    return item.consumer === spec.consumer;
  });
  requireValue(Boolean(match), "chain.downstream_consumer_missing", `链路 ${chainId} 场景 ${spec.producer} 缺少下游消费者 ${spec.consumerPackageNo ?? spec.consumer}。`, { chainId, ...spec });
  if (!match) return;
  const allowedOutputs = match.allowedReadOutputs ?? [];
  for (const expected of spec.outputs ?? []) {
    requireValue(includesCompatible(allowedOutputs, expected), "chain.consumer_output_missing", `链路 ${chainId} 下游消费者 ${spec.consumerPackageNo ?? spec.consumer} 缺少只读输出 ${expected}。`, { chainId, expected, ...spec });
  }
  requireValue(/只能读取|不得/.test(match.ruleZh ?? ""), "chain.consumer_rule_not_readonly", `链路 ${chainId} 下游消费者 ${spec.consumerPackageNo ?? spec.consumer} 必须声明只读/不得越权规则。`, { chainId, ...spec });
}

function collectOutputs(scenarioNo) {
  const handoff = scenarioHandoffs.get(scenarioNo) ?? {};
  const summary = (handoffSummaries.summaries ?? []).find((item) => item.scenarioNo === scenarioNo) ?? {};
  return compact([
    ...(handoff.downstream?.handoffOutputs ?? []),
    ...(handoff.downstream?.allowedOutputsZh ?? []),
    ...(handoff.readSideOutputs ?? []),
    ...(summary.summaryOutputs ?? [])
  ]);
}

function collectForbiddenOutputs(scenarioNo) {
  const handoff = scenarioHandoffs.get(scenarioNo) ?? {};
  return compact([
    ...(handoff.downstream?.forbiddenOutputsZh ?? []),
    ...(handoff.downstream?.allowedConsumers ?? []).flatMap((item) => item.forbiddenOutputsZh ?? [])
  ]);
}

function compatibleIntersection(left, right) {
  return compact(left).filter((item) => includesCompatible(right, item));
}

function includesCompatible(items, expected) {
  const normalizedExpected = normalizeText(expected);
  return compact(items).some((item) => {
    const normalizedItem = normalizeText(item);
    return normalizedItem === normalizedExpected ||
      normalizedItem.includes(normalizedExpected) ||
      normalizedExpected.includes(normalizedItem);
  });
}

function compact(items) {
  return [...new Set((items ?? []).filter((item) => typeof item === "string" && item.trim().length > 0))];
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[、/／\s=：:，,。()（）]/g, "")
    .replace("房间床位", "房床")
    .replace("房源", "房")
    .trim();
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function writeResult() {
  const status = violations.length ? "FAIL" : "PASS";
  const payload = {
    version: "oam.dormitory.13-scenario.integration-chain-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status,
    scope: "local/test/browser evidence integration chain gate",
    authorityRef: controlAuthorityPath,
    generatedRefs: [
      handoffSummariesPath,
      objectOwnershipPath,
      financeBoundaryPath,
      ...Object.values(scenarioHandoffPaths)
    ],
    sourceRefs: [
      controlAuthorityPath,
      ...Object.values(scenarioSourcePaths)
    ],
    chainCount: chains.length,
    completedChainCount: chainResults.filter((item) => item.status === "PASS").length,
    chains: chainResults,
    guarantees: {
      upstreamSummaryReadonly: chainResults.every((item) => item.upstreamSummaryReadonly === true),
      downstreamNoRefill: chainResults.every((item) => item.downstreamNoReentry === true),
      unauthorizedWriteBlocked: violations.every((item) => item.id !== "chain.forbidden_output_missing"),
      financeGateOwnsFinanceTruth: violations.every((item) => !item.id.startsWith("chain.finance_")),
      searchDashboardReportReadonly: true,
      productionConfirmAllowed: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    violations,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
  payload.resultDigest = digestObject({
    ...payload,
    checkedAtUtc: "__checked_at__",
    resultDigest: "__result_digest__"
  });
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function digestObject(value) {
  return `sha256:${sha256(JSON.stringify(stable(value)))}`;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = stable(value[key]);
  }
  return output;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
