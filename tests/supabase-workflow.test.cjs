const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace(/\r\n/g,'\n');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,'runtime extraction anchors');return html.slice(a,b);}
function fixture(){
 const calls=[],errors=[],cache=new Map();
 const context=vm.createContext({console,appUser:{token:'fixture'},state:{claimBills:[{billId:'B',revision:2}]},window:{crypto:globalThis.crypto},
  sessionStorage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},showLoader(){},hideLoader(){},showToast(){},setTimeout(){},
  handleClaimBillAuthError(){return false;},Swal:{fire:(...args)=>errors.push(args)},
  AkraSupabaseReturnitem:new Proxy({},{get:(_,method)=>async payload=>{calls.push({method,payload});if(context.fail)throw context.fail;return{status:'success',billId:'B'};}})});
 new vm.Script(section('        async function postData(','        // --- 4. NAVIGATION')).runInContext(context);
 new vm.Script(section('        function makeMutationId()','        async function handleClaimBillSubmit(')).runInContext(context);
 return{context,calls,errors,cache};
}
test('actual dispatcher routes edit with revision, token adapter preserves action and mutation identity',async()=>{
 const f=fixture();await f.context.postData({action:'updateClaimBillItems',billId:'B',items:[{sku:'A',qty:2}]},false);
 assert.equal(f.calls[0].method,'updateClaimBillItems');assert.equal(f.calls[0].payload.expectedRevision,2);assert(f.calls[0].payload.mutationId);
 let sent;const clientCtx=vm.createContext({fetch:async(url,opts)=>{sent=JSON.parse(opts.body);return{ok:true,json:async()=>({status:'success'})};}});
 new vm.Script(fs.readFileSync(path.join(__dirname,'../js/supabase-returnitem-client.js'),'utf8')).runInContext(clientCtx);
 await clientCtx.AkraSupabaseReturnitem.updateClaimBillItems({...f.calls[0].payload,action:'addReturn'},'fixture-token');
 assert.equal(sent.action,'updateClaimBillItems');assert.equal(sent.token,'fixture-token');assert.equal(sent.mutationId,f.calls[0].payload.mutationId);
});
test('ambiguous retry retains original mutation and revision even after refresh',async()=>{
 const f=fixture(),p={action:'updateClaimBillItems',billId:'B',items:[{sku:'A',qty:2}]};f.context.fail=new Error('response lost');
 assert.equal(await f.context.postData(p,false),false);f.context.state.claimBills[0].revision=3;f.context.fail=null;
 assert(await f.context.postData(p,false));assert.equal(f.calls[0].payload.mutationId,f.calls[1].payload.mutationId);assert.equal(f.calls[1].payload.expectedRevision,2);
 assert.deepEqual(JSON.parse(f.cache.values().next().value),{});
});
test('definitive rejection has no success result and next deliberate attempt gets fresh key',async()=>{
 const f=fixture(),p={action:'createClaimBill',vendor:'V',warehouse:'W1',items:[]};f.context.fail=Object.assign(new Error('insufficient'),{status:409});
 assert.equal(await f.context.postData(p,false),false);f.context.fail=null;await f.context.postData(p,false);
 assert.notEqual(f.calls[0].payload.mutationId,f.calls[1].payload.mutationId);assert.equal(f.errors.length,1);
});
test('interleaved warehouse requests preserve each unresolved original identity',async()=>{
 const f=fixture(),a={action:'createClaimBill',vendor:'V',warehouse:'W1',items:[{sku:'A',qty:2}]},b={...a,warehouse:'W2'};
 f.context.fail=new Error('response lost');await f.context.postClaimMutation('create:V',a,false);f.context.fail=null;
 await f.context.postClaimMutation('create:V',b,false);await f.context.postClaimMutation('create:V',a,false);
 assert.equal(f.calls[0].payload.mutationId,f.calls[2].payload.mutationId);assert.notEqual(f.calls[0].payload.mutationId,f.calls[1].payload.mutationId);
});
test('retired and unknown actions never invoke a client mutation',async()=>{
 const f=fixture();for(const action of ['createAudit','bulkUpdateStatus','unexpected'])assert.equal(await f.context.postData({action},false),false);
 assert.equal(f.calls.length,0);
});
test('bulk basket payload retains quantity, reason, remark and dates',async()=>{
 const f=fixture();await f.context.postData({action:'addDrafts',drafts:[{sku:'A',name:'A',qty:0,reportDate:'09/09/2026',expDate:'10/09/2026',reason:'broken',remark:'box 2',foundLocation:'shelf'}]},false);
 const {method,payload}=f.calls[0];assert.equal(method,'bulkIntakeDamaged');assert.equal(payload.items[0].qty,0);assert.equal(payload.items[0].dateStr,'2026-09-09');assert.equal(payload.items[0].remark,'box 2');assert.equal(payload.items[0].whStatus,'ยังไม่รับ');
});
test('Other customer queue executes actual renderer and counts every open compensation',()=>{
 const elements={};const context=vm.createContext({state:{returns:[{source:'หน้าร้าน/ลูกค้า',compensation:'เปลี่ยนรุ่น',customerStatus:'',id:'R',sku:'A',qty:1,name:'Fixture'},{source:'หน้าร้าน/ลูกค้า',compensation:'หักลดหนี้ในบิลถัดไป',customerStatus:'',id:'R2'}]},document:{getElementById:id=>elements[id]||(elements[id]={})},esc:v=>String(v)});
 new vm.Script(section('        function renderTrackCust()','        function renderDrafts()')).runInContext(context);context.renderTrackCust();
 assert.equal(elements['cust-other-count'].innerText,1);assert.equal(elements['cust-credit-count'].innerText,1);
});
test('modern role-only UI denies capabilities while supported legacy tokens retain access',()=>{
 const context=vm.createContext({appUser:{roles:['ADMIN'],tokenVersion:2},decodeJwtPayload:()=>null});
 new vm.Script(section('        const LEGACY_ROLE_PERMISSIONS','        // --- 2. GLOBAL UI UTILS')).runInContext(context);
 assert.equal(context.can('MANAGE_CLM'),false);context.appUser={roles:['ADMIN']};assert.equal(context.can('MANAGE_CLM'),true);
 context.appUser={roles:['ADMIN'],perms:{'app-ret':['ADD_RET']},tokenVersion:2};assert.equal(context.can('ADD_RET'),true);assert.equal(context.can('MANAGE_CLM'),false);
});
test('actual CSV handler never downloads on mutation failure; successful batch is limited to exact 200 IDs',async()=>{
 for(const accepted of [false,true]){
  const button={},events=[],pending=[];
  const context=vm.createContext({state:{returns:Array.from({length:201},(_,i)=>({id:'R'+i,status:'รอตัดรอบ',sku:'A',qty:1}))},
   document:{getElementById:()=>button},Swal:{fire:()=>({then:fn=>pending.push(fn({isConfirmed:true}))})},
   postData:async p=>{events.push(['save',p.ids.length,p.expectedCount]);return accepted;},exportToCSV:rows=>events.push(['download',rows.length]),showToast:()=>events.push(['toast'])});
  new vm.Script(section("            const btnExport = document.getElementById('btn-export');",'\n        }\n\n        // --- 8. RENDER UI ---')).runInContext(context);
  await button.onclick();await Promise.all(pending);
  assert.deepEqual(events,accepted?[['save',200,200],['download',201],['toast']]:[['save',200,200]]);
 }
});
test('history reader includes cancelled quantities only when explicitly requested',()=>{
 const context=vm.createContext({state:{claimBillLines:[{billId:'A',lineStatus:'Cancelled',qty:5},{billId:'B',lineStatus:'Active',qty:9}]}});
 new vm.Script(section('        function billLines(','        function mergeClaimBillLines(')).runInContext(context);
 assert.equal(context.billLines('A').length,0);assert.equal(context.billLines('A',true)[0].qty,5);assert.equal(context.billLines('A',true).length,1);
});
