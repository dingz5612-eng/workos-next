import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const base = 'http://127.0.0.1:5173/?api=http%3A%2F%2F127.0.0.1%3A5191';
const outDir = 'artifacts/local-demo/resource-journey';
const api = 'http://127.0.0.1:5191';
const shot = async (page, name) => {
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log(`${name}: ${await page.title().catch(()=>'')}`);
};
const wait = async (page) => page.waitForTimeout(700);
async function login(page) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.setItem('workosnext.apiBaseUrl', 'http://127.0.0.1:5191');
    localStorage.setItem('workosnext.lang', 'zh-CN');
    localStorage.setItem('workosnext.onboarded', '1');
    const resp = await fetch('http://127.0.0.1:5191/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ username: 'operator', password: 'dev' }) });
    const session = await resp.json();
    localStorage.setItem('workosnext.actorSession', JSON.stringify(session));
  });
}
async function fillVisibleFields(page, values) {
  const fields = await page.locator('[data-operation-field]:visible:not([readonly])').evaluateAll(nodes => nodes.map(n => ({ id: n.dataset.operationField, tag: n.tagName, type: n.type, value: n.value })));
  console.log('visible fields', JSON.stringify(fields));
  for (const [id, value] of Object.entries(values)) {
    const loc = page.locator(`[data-operation-field="${id}"]:visible`).first();
    if (await loc.count()) {
      const tag = await loc.evaluate(n => n.tagName.toLowerCase());
      if (tag === 'select') await loc.selectOption({ label: String(value) }).catch(async () => loc.selectOption(String(value)));
      else await loc.fill(String(value));
    }
  }
}
async function openCard(page, cardId) {
  await page.goto(`${base}&view=workspace&workspace=W-STAY-RESOURCE&card=${cardId}`, { waitUntil: 'networkidle' });
  await wait(page);
}
async function submitCurrent(page) {
  const btn = page.locator('[data-submit-card]:visible').first();
  const txt = await btn.textContent().catch(() => '');
  console.log('submit button', txt);
  await btn.click();
  await page.waitForTimeout(2200);
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
page.on('console', msg => console.log('PAGE', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGEERROR', err.message));
await login(page);
await openCard(page, 'roomSetup');
await shot(page, '01-room-setup-open');
await fillVisibleFields(page, {
  building: 'B栋', buildingId: 'B栋', roomNo: 'B401', roomNumber: 'B401', roomId: 'B401',
  roomType: '四人间', capacity: '4', bedCount: '4', genderPolicy: '未限制', furnitureStatus: '家具齐全', technicalStatus: '可入住', remark: '真实演示新建 B401 四人间'
});
await wait(page);
await shot(page, '02-room-setup-input');
await submitCurrent(page);
await shot(page, '03-room-setup-submitted');

await openCard(page, 'bedSetup');
await shot(page, '04-bed-setup-open');
await fillVisibleFields(page, {
  roomId: 'B401', room: 'B401', bedId: 'B401-01', bedNo: 'B401-01', bedLabel: '1号下铺', bedType: '下铺', bedStatus: '可分配', initialBedStatus: '可分配', blockReason: '无'
});
await wait(page);
await shot(page, '05-bed-setup-input');
await submitCurrent(page);
await shot(page, '06-bed-setup-submitted');

await openCard(page, 'rateSetup');
await shot(page, '07-rate-setup-open');
await fillVisibleFields(page, {
  roomId: 'B401', room: 'B401', dailyRate: '80', weeklyRate: '520', monthlyRate: '1900', currency: 'KGS', effectiveDate: '2026-06-03T09:00', priceRemark: 'B401 内测价格'
});
await wait(page);
await shot(page, '08-rate-setup-input');
await submitCurrent(page);
await shot(page, '09-rate-setup-submitted');

await openCard(page, 'roomReadiness');
await shot(page, '10-readiness-open');
await fillVisibleFields(page, {
  roomId: 'B401', room: 'B401', operatorId: 'operator', furnitureStatus: '家具齐全', technicalStatus: '可入住', saleStatus: '可售', readinessStatus: '可售', readyStatus: '可售', readyRemark: '已检查床位和门锁'
});
await wait(page);
await shot(page, '11-readiness-input');
await submitCurrent(page);
await shot(page, '12-readiness-submitted');

await openCard(page, 'roomBlock');
await shot(page, '13-block-open');
await fillVisibleFields(page, {
  blockId: 'BLK-B401-01', roomId: 'B401', room: 'B401', bedId: 'B401-01', bed: 'B401-01', blockScope: '床位', blockReason: '演示保留', blockStartTime: '2026-06-03T10:00', expectedRecoveryTime: '2026-06-03T12:00', blockRemark: '演示阻断后释放'
});
await wait(page);
await shot(page, '14-block-input');
await submitCurrent(page);
await shot(page, '15-block-submitted');

await openCard(page, 'roomRelease');
await shot(page, '16-release-open');
await fillVisibleFields(page, {
  releaseId: 'REL-B401-01', roomId: 'B401', room: 'B401', bedId: 'B401-01', bed: 'B401-01', releaseScope: '床位', recoverSaleTime: '2026-06-03T12:30', restoredSaleTime: '2026-06-03T12:30', releaseRemark: '阻断解除，恢复可售'
});
await wait(page);
await shot(page, '17-release-input');
await submitCurrent(page);
await shot(page, '18-release-submitted');

await page.goto(`${base}&view=search&q=B401`, { waitUntil: 'networkidle' });
await wait(page);
await shot(page, '19-search-b401-record');

const statuses = await (await fetch(`${api}/api/workspaces`)).json();
const ws = statuses.workspaces.find(w => w.id === 'W-STAY-RESOURCE');
console.log('FINAL_STATUS', JSON.stringify(ws.cards.map(c => ({ id: c.id, status: c.status }))));
await browser.close();
