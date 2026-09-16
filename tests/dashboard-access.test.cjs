const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('const LEGACY_ROLE_PERMISSIONS'), html.indexOf('// --- 2. GLOBAL UI UTILS'));
for (const user of [
  {roles:['AKRA'],tokenVersion:2,perms:{'app-ret':['ADD_CLM']}},
  {roles:['ADMIN'],tokenVersion:2,perms:{'app-ret':['ADD_RET']}},
  {roles:['TRD']},
  {roles:['ADMIN']},
  {roles:['ADMIN'],tokenVersion:2,perms:{'app-ret':[]}},
]) {
  const tabs = ['DASHBOARD','ADD_RET','QC_RET','ADD_CLM','WH_CLM','MANAGE_CLM','TRACK_CLM'];
  const nodes = tabs.map(tab => ({dataset:{tab},style:{}}));
  const timers = [];
  const ctx = {appUser:user, Set, decodeJwtPayload:()=>null, setTimeout:fn=>timers.push(fn),
    document:{querySelectorAll:()=>nodes,getElementById:()=>null,querySelector:()=>nodes.find(n=>n.style.display!=='none')}};
  vm.createContext(ctx);
  vm.runInContext(source + '\napplyRolePermissions();',ctx);
  assert.notEqual(nodes[0].style.display,'none','dashboard visible for '+JSON.stringify(user));
  assert.equal(timers.length,0,'dashboard does not redirect to another tab');
  for (const node of nodes.slice(1)) {
    const allowed = vm.runInContext(`can('${node.dataset.tab}')`,ctx);
    if (user.tokenVersion === 2) {
      assert.equal(allowed,user.perms['app-ret'].includes(node.dataset.tab),'actions remain explicit');
      assert.equal(node.style.display==='none',!allowed,'restricted navigation remains hidden');
    }
  }
}
console.log('PASS dashboard visible across modern/legacy profiles; action permissions preserved');
