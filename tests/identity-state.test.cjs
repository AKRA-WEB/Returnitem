// Actual Returnitem functions/client, isolated synthetic users, storage and promises.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace(/\r\n/g,'\n');
const client = fs.readFileSync(path.join(__dirname,'../js/supabase-returnitem-client.js'),'utf8');
const original = {id:'reused-name',name:'Original',roles:['ADMIN'],identityId:'10000000-0000-4000-8000-000000000011',sessionVersion:1,authorizationRevision:'rev-one'};
const replacement = {...original,identityId:'10000000-0000-4000-8000-000000000012'};
const token='header.'+Buffer.from(JSON.stringify(original)).toString('base64url')+'.forged';
const section=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert(start>=0&&end>start);return html.slice(start,end);};
const tick=()=>new Promise(setImmediate);
function fixture({local=new Map(),session=new Map(),verify=async()=>original}={}) {
    const events={},nodes=new Map(),errors=[],calls=[];
    const node=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{hidden:false,textContent:'',style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}});}return nodes.get(id);};
    const window={location:{search:'?sso='+token,pathname:'/Returnitem/'},history:{replaceState(){}},crypto:globalThis.crypto,addEventListener:(name,fn)=>events[name]=fn,
        AkraModule:{embedded:false,getToken:()=>'',verifySession:verify,isLocalPreview:()=>false,authRequired(){},home(){}}};
    const ctx=vm.createContext({window,URLSearchParams,Buffer,console:{warn(){},error(){}},document:{title:'Fixture',getElementById:node,querySelectorAll:()=>[]},
        localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},
        sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},
        state:{returns:[],claims:[],claimStock:[],claimBills:[],claimBillLines:[],drafts:[],products:[]},workflowGeneration:0,workflowRequest:null,workflowToken:'',
        alert:m=>errors.push(m),Swal:{close(){},fire:(...args)=>{errors.push(args);return Promise.resolve({});}},MAIN_PORTAL_URL:'/Main/',
        showLoader(){},hideLoader(){},showToast(){},setTimeout(){},returnitemPermissionsForUser:()=>new Set(['ADD_RET']),handleClaimBillAuthError:()=>false,
        AkraSupabaseReturnitem:new Proxy({},{get:(_,method)=>async payload=>{calls.push({method,payload});if(ctx.fail)throw ctx.fail;return {status:'success',billId:'B'};}})});
    vm.runInContext(section('        const ALLOWED_ROLES','    </script>'),ctx);
    vm.runInContext(section('        const RETURN_CACHE_TTL','        function setAutocompleteLoading('),ctx);
    vm.runInContext(section('        async function postData(','        // --- 4. NAVIGATION'),ctx);
    vm.runInContext(section('        function makeMutationId()','        async function handleClaimBillSubmit('),ctx);
    const user=(u,t=token)=>{ctx.nextUser=u?{...u,token:t}:null;vm.runInContext('appUser=nextUser',ctx);};
    return {ctx,window,local,session,errors,calls,events,node,user};
}
test('standalone URL/cached claims wait for Main; denial and concurrent login cannot authorize or overwrite',async()=>{
    for(const cached of [false,true]) for(const outcome of ['allow','deny','replaced']) {
        let finish,count=0;
        const f=fixture({verify:(id,t)=>{assert.equal(id,'app-damage');assert.equal(t,token);count++;return new Promise((resolve,reject)=>finish=()=>outcome==='deny'?reject(Error('invalid_session')):resolve(original));}});
        if(cached){f.window.location.search='';f.local.set('akra_returnitem_session',JSON.stringify({...original,token}));}
        const pending=f.ctx.verifyAccess();await tick();
        assert.equal(vm.runInContext('appUser',f.ctx),null,'unverified decoded claims never become page owner');assert.equal(count,1);
        if(outcome==='replaced')f.local.set('akra_returnitem_session','new-tab-login');
        finish();assert.equal(await pending,outcome==='allow');
        if(outcome==='allow')assert.equal(vm.runInContext('appUser.identityId',f.ctx),original.identityId);
        if(outcome==='replaced')assert.equal(f.local.get('akra_returnitem_session'),'new-tab-login');
    }
});
test('read cache partitions UUID/session/revision and does not import/delete legacy keys',()=>{
    const f=fixture();f.local.set('wms_ret_active_v1','legacy');f.user(original);
    f.ctx.setCache(f.ctx.activeCacheKey(),{marker:'original'});
    assert.equal(f.ctx.getCache(f.ctx.activeCacheKey(),60000).marker,'original');
    for(const u of [replacement,{...original,sessionVersion:2},{...original,authorizationRevision:'rev-two'},null]){
        f.user(u);assert.equal(f.ctx.getCache(f.ctx.activeCacheKey(),60000),null);
    }
    f.user(original);assert.equal(f.ctx.getCache(f.ctx.activeCacheKey(),60000).marker,'original');
    assert.equal(f.local.get('wms_ret_active_v1'),'legacy');
});
test('pending receipts survive reload only for original UUID with original payload/revision',async()=>{
    const session=new Map(),a={action:'updateClaimBillItems',billId:'B',items:[{sku:'A',qty:2}]};
    const f=fixture({session});f.user(original);f.ctx.state.claimBills=[{billId:'B',revision:2}];f.ctx.fail=Error('lost reply');
    assert.equal(await f.ctx.postClaimMutation('edit:B',a,false),false);const first=f.calls[0].payload;
    const other=fixture({session});other.user(replacement);assert(await other.ctx.postClaimMutation('edit:B',a,false));
    assert.notEqual(other.calls[0].payload.mutationId,first.mutationId);
    const reload=fixture({session});reload.user(original);reload.ctx.state.claimBills=[{billId:'B',revision:9}];
    assert(await reload.ctx.postClaimMutation('edit:B',a,false));
    assert.equal(reload.calls[0].payload.mutationId,first.mutationId);assert.equal(reload.calls[0].payload.expectedRevision,2);
});
test('unknown legacy pending, absent identity and unavailable durable storage block before send',async()=>{
    for(const mode of ['legacy','missing','storage','silent-storage']){
        const f=fixture();f.user(mode==='missing'?{...original,identityId:null}:original);
        if(mode==='legacy')f.session.set('returnitem_pending_claim_mutations_v1',JSON.stringify({unknown:{mutationId:'old'}}));
        if(mode==='storage')f.ctx.sessionStorage.setItem=()=>{throw Error('quota');};
        if(mode==='silent-storage')f.ctx.sessionStorage.setItem=()=>{};
        assert.equal(await f.ctx.postClaimMutation('create:V',{action:'createClaimBill',vendor:'V'},false),false);
        assert.equal(f.calls.length,0,mode+' must make zero writes');
        if(mode==='legacy')assert(f.session.has('returnitem_pending_claim_mutations_v1'));
    }
});
test('late adapter read/write/search replies cannot return old owner data',async()=>{
    for(const action of ['getInitialData','createClaimBill','searchProducts']){
        const f=fixture();f.user(original);f.window.self=f.window;f.ctx.self=f.window;
        let finish;f.ctx.fetch=()=>new Promise(resolve=>finish=resolve);vm.runInContext(client,f.ctx);
        const api=f.window.AkraSupabaseReturnitem;
        const pending=action==='getInitialData'?api[action](token):action==='searchProducts'?api[action]('A'):api[action]({vendor:'V'},token);
        f.user(replacement,'new-token');finish({ok:true,json:async()=>({status:'success',privateRows:['old']})});
        await assert.rejects(pending,e=>e.reason==='session_changed');
    }
});
test('storage replacement hides private UI and preserves new login plus uncertain original receipt',async()=>{
    const f=fixture();await f.ctx.verifyAccess();
    // The production startup calls this after successful verification.
    f.ctx.bindReturnitemSessionEvents();
    const a={action:'createClaimBill',vendor:'V'};let finish;
    f.ctx.AkraSupabaseReturnitem={createClaimBill:()=>new Promise(resolve=>finish=resolve)};
    const pending=f.ctx.postClaimMutation('create:V',a,false);
    f.local.set('akra_returnitem_session','new-tab-login');
    f.events.storage({key:'akra_returnitem_session',oldValue:'old',newValue:'new'});
    assert.equal(vm.runInContext('appUser',f.ctx),null);assert.equal(f.node('app-shell').hidden,true);
    assert.equal(f.local.get('akra_returnitem_session'),'new-tab-login');
    finish({status:'success',billId:'B'});assert.equal(await pending,false);
    const own=[...f.session].find(([k])=>k.includes(original.identityId));assert(own);assert.notEqual(own[1],'{}','late receipt must stay reconcilable');
});
test('overlapping identical sends stay single-flight; another definitive rejection cannot clear an uncertain receipt',async()=>{
    const f=fixture();f.user(original);const pending=[];
    f.ctx.AkraSupabaseReturnitem={createClaimBill:payload=>new Promise((resolve,reject)=>pending.push({payload,resolve,reject}))};
    const a={action:'createClaimBill',vendor:'A'},b={...a,vendor:'B'};
    const first=f.ctx.postClaimMutation('create:A',a,false);
    assert.equal(await f.ctx.postClaimMutation('create:A',a,false),false);
    const duplicate=f.ctx.postClaimMutation('create:A',a,false);
    assert.equal(pending.length,1,'a duplicate must not release the first in-flight lock');
    assert.equal(await duplicate,false);
    const second=f.ctx.postClaimMutation('create:B',b,false);
    pending[0].reject(Error('response lost'));pending[1].reject(Object.assign(Error('definitive'),{status:409}));
    await Promise.all([first,second]);
    const records=Object.values(JSON.parse([...f.session.values()][0]));
    assert.equal(records.length,1);assert.equal(records[0].payload.vendor,'A');
    let retries=0;f.ctx.AkraSupabaseReturnitem={createClaimBill:async()=>{retries++;return {status:'success',billId:'B'};}};
    f.ctx.sessionStorage.setItem=(k,v)=>{if(v==='{}')throw Error('cleanup quota');f.session.set(k,v);};
    assert(await f.ctx.postClaimMutation('create:A',a,false),'confirmed result survives failed local cleanup');assert.equal(retries,1);
});
test('unreadable successful transport response remains ambiguous, no empty success or cleared receipt',async()=>{
    const f=fixture();f.user(original);f.ctx.self=f.window;
    f.ctx.fetch=async()=>({ok:true,json:async()=>{throw Error('truncated JSON');}});
    vm.runInContext(client,f.ctx);f.ctx.AkraSupabaseReturnitem=f.window.AkraSupabaseReturnitem;
    assert.equal(await f.ctx.postClaimMutation('create:A',{action:'createClaimBill',vendor:'A'},false),false);
    assert.equal(Object.keys(JSON.parse([...f.session.values()][0])).length,1);
});
