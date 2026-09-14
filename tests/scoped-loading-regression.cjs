const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
async function run(adapter = fs.readFileSync(path.join(__dirname, '../js/supabase-returnitem-client.js'), 'utf8')) {
  const sent = [];
  const adapterCtx = { module: { exports: {} }, fetch: async (url, options) => { sent.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ status: 'success' }) }; } };
  vm.createContext(adapterCtx); new vm.Script(adapter).runInContext(adapterCtx);
  await adapterCtx.module.exports.getInitialData('fixture', 300);
  await adapterCtx.module.exports.getInitialData('fixture', 300, { includeClaimDetails: false });
  assert.equal(Object.hasOwn(sent[0], 'includeClaimDetails'), false, 'legacy call remains omitted');
  assert.equal(sent[1].includeClaimDetails, false, 'scoped call forwards explicit false');

  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').replace(/\r\n/g, '\n');
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) if (match[1].trim()) new vm.Script(match[1]);
  const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
  let tab = 'ADD_RET';
  const calls = [], pending = [], renders = [], alerts = [], elements = new Map();
  const element = id => { if (!elements.has(id)) { const classes = new Set(); elements.set(id, { innerHTML: '', classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n) } }); } return elements.get(id); };
  const ctx = { appUser: { token: 'a' }, state: { returns: [], claims: [], claimStock: [], claimDetailsRequested: false, claimDetailsLoaded: false },
    document: { querySelector: q => q === '.tab-content.active' ? { id: 'tab-' + tab } : null, getElementById: element },
    getFirstVisibleTab: () => 'ADD_RET', showLoader() {}, hideLoader() {}, setCache() {}, cacheSafeActiveData: x => x, activeCacheKey: () => 'fixture', localStorage: { removeItem() {} },
    handleClaimBillAuthError: error => { if (error.reason) { alerts.push(error.reason); return true; } return false; },
    Swal: { fire: (...args) => alerts.push(args) }, console: { error() {} }, lucide: { createIcons() {} },
    renderClaimStock: () => renders.push('stock'), renderTrackClaim() {}, renderClaimBills: () => renders.push('bills'), renderDashboard() {}, drawDashboardChart() {},
    AkraSupabaseReturnitem: { getInitialData: (token, limit, options) => { calls.push({ token, ...options }); return new Promise((resolve, reject) => pending.push({ resolve, reject })); } }
  };
  vm.createContext(ctx);
  new vm.Script(section('        let workflowRequest =', '        async function postData(') + '\n' + section('        function renderTabContent(', '        // --- 8. RENDER UI ---')).runInContext(ctx);
  ctx.renderUI = () => { renders.push('ui'); ctx.renderTabContent(tab); };
  const result = (name, full) => ({ status: 'success', data: { returns: [{ id: name }], claims: [{ id: 'claim-' + name }], claimStock: full ? [{ id: name, availableQty: 2 }] : [], claimBills: [], claimBillLines: [], claimBillReady: full, claimDetailsLoaded: full, claimStockCount: 7 } });
  const initial = ctx.fetchData(); const overlap = ctx.fetchData(false);
  assert.equal(calls.length, 1); assert.equal(calls[0].includeClaimDetails, false);
  pending[0].resolve(result('initial', false)); await Promise.all([initial, overlap]);
  assert.equal(ctx.state.returns[0].id, 'initial'); assert.equal(ctx.state.claims.length, 1); assert.equal(ctx.pendingVendorClaimCount(), 7);

  tab = 'MANAGE_CLM'; ctx.renderTabContent(tab); ctx.renderTabContent(tab);
  assert.equal(calls.length, 2); assert.equal(calls[1].includeClaimDetails, true);
  assert.match(element('manage_acc').innerHTML, /กำลังโหลด/);
  assert.equal(element('claim-bill-setup-warning').classList.contains('hidden'), true);
  pending[1].resolve(result('full', true)); await new Promise(setImmediate);
  assert.equal(ctx.state.claimDetailsLoaded, true); assert.equal(ctx.state.claimDetailsRequested, true); assert.equal(ctx.state.returns[0].id, 'full');
  assert.ok(renders.includes('stock'));

  const old = ctx.fetchData(false); const fresh = ctx.fetchData(false, true);
  assert.equal(calls.length, 4, 'mutation/explicit refresh must not reuse older in-flight response');
  pending[3].resolve(result('fresh', true)); await fresh;
  pending[2].resolve(result('stale', true)); await old;
  assert.equal(ctx.state.returns[0].id, 'fresh');
  const priorSession = ctx.fetchData(false); ctx.appUser.token = 'b'; tab = 'ADD_RET'; const nextSession = ctx.fetchData(false);
  pending[5].resolve(result('session-b', false)); await nextSession;
  pending[4].resolve(result('session-a', true)); await priorSession;
  assert.equal(ctx.state.returns[0].id, 'session-b'); assert.equal(ctx.state.claimDetailsLoaded, false);

  tab = 'TRACK_CLM'; ctx.renderTabContent(tab); pending[6].reject(new Error('fixture read failure')); await new Promise(setImmediate);
  const countAfterError = calls.length; ctx.renderTabContent(tab);
  assert.equal(calls.length, countAfterError, 'failure does not spin in automatic retry loop');
  assert.match(element('bill_wait_list').innerHTML, /ลองอีกครั้ง/);
  const retry = ctx.fetchData(false, true, true); pending[7].resolve(result('retry', true)); await retry;
  assert.equal(ctx.state.claimDetailsLoaded, true);

  // Old backend response (no marker) remains fully rendered and does not lazy-loop.
  tab = 'ADD_RET'; const legacy = ctx.fetchData(false, true); const legacyData = result('legacy', true); delete legacyData.data.claimDetailsLoaded;
  pending[8].resolve(legacyData); await legacy;
  assert.equal(ctx.state.claimDetailsRequested, true);
  tab = 'MANAGE_CLM'; ctx.renderTabContent(tab); assert.equal(calls.length, 9);
  ctx.appUser.token = ''; await ctx.fetchData(); assert.equal(calls.length, 9); assert.equal(alerts.at(-1), 'no_token');
  return 'PASS Returnitem scoped startup/counts, lazy detail dedup, fresh mutation refresh, stale/session isolation, retry/legacy/missing token';
}
module.exports = { run };
if (require.main === module) run().then(console.log).catch(error => { console.error(error); process.exitCode = 1; });
