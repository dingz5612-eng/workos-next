import { writeJson } from "./lib/capability-delivery-control-plane.mjs";
import {
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  buildCapabilityTestPlan
} from "./lib/capability-projection-digests.mjs";

const root = process.cwd();
const plan = buildCapabilityTestPlan(root);
writeJson(FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH, plan, root);
console.log(`Dormitory first golden chain generated test plan: ${FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH}`);
console.log(plan.testPlanDigest);
