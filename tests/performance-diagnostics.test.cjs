// Actual dashboard switching with synthetic DOM/session; no live calls or data writes.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function section(start, end) { const a = html.indexOf(start), b = html.indexOf(end, a); assert(a >= 0 && b > a); return html.slice(a, b); }
const helper = section("        const CURRENT_VERSION =", '        async function checkAppVersion(');
const navigation = section('        function setupDashboardNav()', '        window.filterDashboard =');
function rig(search = '?akra_perf=1') {
  const nodes = new Map(), frames = [], buttons = []; let clock = 10, routes = 0, apiCalls = 0;
  const element = id => { if (!nodes.has(id)) { const classes = new Set(); nodes.set(id, { id, hidden: false,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    getBoundingClientRect: () => ({ width: 500 }), setAttribute() {} }); } return nodes.get(id); };
  for (const view of ['overview', 'returns', 'claims']) { const node = element('dash-view-' + view); buttons.push({ dataset: { dashview: view }, classList: node.classList }); }
  element('dash-view-overview').classList.add('active');
  const context = vm.createContext({ URLSearchParams, performance: { now: () => clock }, requestAnimationFrame: fn => frames.push(fn),
    window: { location: { search } }, appUser: { token: 'fixture-only' },
    state: { workflowReady: true, claimDetailsRequested: true, claimDetailsLoading: false, claimDetailsError: false },
    document: { getElementById: id => id === 'akra-perf-diagnostics' ? nodes.get(id) : element(id), createElement: () => ({ setAttribute() {} }),
      body: { appendChild: node => nodes.set(node.id, node) },
      querySelectorAll: selector => selector === '.dash-nav' ? buttons : [...nodes.values()].filter(node => node.id.startsWith('dash-view-')),
      querySelector: () => null },
    updateRouteState: () => { routes++; }, currentWorkflowTab: () => 'DASHBOARD',
    getReturnitemToken: () => context.appUser?.token || '',
    isCurrentReturnitemSession: (owner, token) => !!owner && owner === context.appUser && !!token && token === context.appUser.token,
    fetch: () => { apiCalls++; throw Error('view switch must not fetch'); }
  });
  const run = source => vm.runInContext(source, context); run(helper); run(navigation); run('setupDashboardNav()');
  const events = () => JSON.parse(nodes.get('akra-perf-diagnostics')?.textContent || '{"events":[]}').events;
  const frame = () => { clock += 16; frames.shift()?.(); };
  return { context, run, buttons, element, events, frame, frames, routes: () => routes, apiCalls: () => apiCalls };
}
test('normal switching keeps route and visibility with no diagnostics work or API requests', () => {
  for (const search of ['', '?akra_perf=true']) {
    const f = rig(search); f.buttons[1].onclick();
    assert.equal(f.context.window.AkraPerf, null); assert.equal(f.frames.length, 0); assert.equal(f.events().length, 0);
    assert.equal(f.routes(), 1); assert.equal(f.apiCalls(), 0); assert(f.element('dash-view-returns').classList.contains('active'));
  }
});
test('view-ready marker follows two frames and the real active visible target without an API', () => {
  const f = rig(); f.buttons[1].onclick();
  assert.equal(f.events().find(e => e.stage === 'dashboard_view_handler').requestCount, 0);
  assert.equal(f.events().filter(e => e.stage === 'dashboard_view_ready').length, 0); f.frame();
  assert.equal(f.events().filter(e => e.stage === 'dashboard_view_ready').length, 0); f.frame();
  const ready = f.events().find(e => e.stage === 'dashboard_view_ready');
  assert.equal(ready.durationMs, 32); assert.equal(ready.view, 'returns'); assert.equal(ready.trial, 1); assert.equal(f.apiCalls(), 0);
});
test('an older queued switch cannot publish readiness after a newer switch to the same view', () => {
  const f = rig(); f.buttons[1].onclick(); f.buttons[1].onclick(); while (f.frames.length) f.frame();
  assert.deepEqual(f.events().filter(e => e.stage === 'dashboard_view_ready').map(e => e.trial), [2]);
});
for (const change of ['session', 'hidden', 'tab']) test(`queued view completion rejects ${change} change`, () => {
  const f = rig(); f.buttons[1].onclick();
  if (change === 'session') f.context.appUser = { token: 'replacement' };
  if (change === 'hidden') f.element('dash-view-returns').getBoundingClientRect = () => ({ width: 0 });
  if (change === 'tab') f.context.currentWorkflowTab = () => 'ADD_RET';
  while (f.frames.length) f.frame(); assert.equal(f.events().filter(e => e.stage === 'dashboard_view_ready').length, 0);
});
test('Dashboard entry readiness remains separate and waits for fresh details settlement', () => {
  const f = rig();
  f.run("window.AkraPerf.nextTrial(); window.AkraPerf.beginEntry(window.AkraPerf.now(),()=>true); state.claimDetailsLoading=true; completeReturnPerfEntry()");
  assert.equal(f.frames.length, 0);
  f.run('state.claimDetailsLoading=false;completeReturnPerfEntry()'); f.frame(); f.frame();
  assert.equal(f.events().find(e => e.stage === 'dashboard_enter_ready').durationMs, 32);
  assert.equal(f.events().filter(e => e.stage === 'dashboard_view_ready').length, 0);
});
test('cancelled Dashboard entry cannot publish after a later settlement', () => {
  const f = rig(); f.run('window.AkraPerf.nextTrial();window.AkraPerf.beginEntry(0,()=>true);window.AkraPerf.cancelEntry();completeReturnPerfEntry()');
  assert.equal(f.frames.length, 0); assert.equal(f.events().length, 0);
});
test('bounded hidden schema emits allowlisted aggregate fields only', () => {
  const f = rig(); f.run("for(let i=0;i<100;i++)window.AkraPerf.record('workflow_ready',0,{returns:2,claims:1,status:'success',token:'private-secret',actor:'private-actor',url:'https://private.invalid',rows:Infinity});window.AkraPerf.record('private-stage',0,{});");
  const node = f.element('akra-perf-diagnostics'), result = JSON.parse(node.textContent);
  assert.equal(result.events.length, 80); assert.equal(result.app, 'RETURN'); assert.equal(node.hidden, true);
  assert.equal(result.version, JSON.parse(fs.readFileSync(path.join(__dirname, '../version.json'))).version);
  assert(!/private|https|actor|token|url/.test(node.textContent));
  assert.deepEqual(Object.keys(result.events[0]).sort(), ['claims', 'durationMs', 'returns', 'sequence', 'stage', 'status', 'trial']);
});
