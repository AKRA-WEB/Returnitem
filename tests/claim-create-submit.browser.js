async page => {
  await page.unroute('**/macros/s/**');
  const posted = [];
  let backendReady = false;
  let createCount = 0;
  await page.route('**/macros/s/**', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData() || '{}');
      posted.push(payload);
      if (payload.action === 'createClaimBill') {
        createCount += 1;
        if (createCount === 1) await page.waitForTimeout(1200);
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload.action === 'initClaimBillSheets'
          ? { status:'success', data:{ sheets:['ClaimBill', 'ClaimBillLine', 'ClaimMutation'] } }
          : { status:'success', data:{ billId:'CLB-BROWSER-CREATE-' + createCount, status:'พร้อมส่งเคลม' } })
      });
    }

    const requestUrl = request.url();
    const callback = decodeURIComponent(((requestUrl.match(/[?&]callback=([^&]+)/) || [])[1] || ''));
    const action = decodeURIComponent(((requestUrl.match(/[?&]action=([^&]+)/) || [])[1] || ''));
    const data = action === 'getProducts'
      ? { products:[] }
      : {
          products:[], claims:[], returns:[], audits:[],
          claimStock:[{
            vendor:'Vendor Browser', sku:'SKU-CREATE', name:'สินค้าสร้างบิล', unit:'ชิ้น',
            receivedQty:5, allocatedQty:0, availableQty:5
          }],
          claimBills:[], claimBillLines:[], claimBillReady:backendReady, claimBillAccess:true,
          claimBillAuthError:null, claimBillHistoryNextOffset:0, claimBillHistoryHasMore:false
        };
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: callback + '(' + JSON.stringify({ status:'success', data }) + ');'
    });
  });

  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForFunction(() => typeof activateTab === 'function' && state.claimStock.length === 1 && !document.getElementById('global-loader').classList.contains('flex'));
  await page.evaluate(() => activateTab('MANAGE_CLM'));

  const input = page.locator('#manage_acc input[name="claimQty"]');
  await input.fill('2');
  const submitButton = page.getByRole('button', { name:'ออกใบส่งเคลมจากจำนวนที่เลือก' });
  if (await submitButton.isDisabled()) throw new Error('First-use claim-bill setup leaves the create button disabled');
  await submitButton.click();
  await page.getByRole('button', { name:'ออกใบเคลม' }).click();
  await page.waitForFunction(() => document.querySelector('#manage_acc button[type="submit"]'));
  await page.waitForTimeout(900);
  if (!await page.getByRole('button', { name:'ออกใบส่งเคลมจากจำนวนที่เลือก' }).isDisabled()) {
    throw new Error('Setup refresh replaced the in-flight disabled form before create completed');
  }
  await page.getByText('เลขที่ CLB-BROWSER-CREATE-1').waitFor({ state:'visible' });

  if (posted.length !== 2 || posted[0].action !== 'initClaimBillSheets') {
    throw new Error('First create attempt did not prepare all claim-bill sheets: ' + JSON.stringify(posted));
  }
  const createRequest = posted[1];
  if (createRequest.action !== 'createClaimBill' || createRequest.vendor !== 'Vendor Browser') {
    throw new Error('Create-bill POST identity is wrong: ' + JSON.stringify(createRequest));
  }
  if (JSON.stringify(createRequest.items) !== JSON.stringify([{ sku:'SKU-CREATE', unit:'ชิ้น', qty:2 }])) {
    throw new Error('Selected quantity did not survive first-use setup: ' + JSON.stringify(createRequest.items));
  }
  if (!createRequest.mutationId) throw new Error('Create-bill POST is missing its idempotency key');

  backendReady = true;
  posted.length = 0;
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForFunction(() => typeof activateTab === 'function' && state.claimBillReady && state.claimStock.length === 1 && !document.getElementById('global-loader').classList.contains('flex'));
  await page.evaluate(() => activateTab('MANAGE_CLM'));
  await page.locator('#manage_acc input[name="claimQty"]').fill('1');
  await page.getByRole('button', { name:'ออกใบส่งเคลมจากจำนวนที่เลือก' }).click();
  await page.getByRole('button', { name:'ออกใบเคลม' }).click();
  await page.getByText('เลขที่ CLB-BROWSER-CREATE-2').waitFor({ state:'visible' });
  if (posted.length !== 1 || posted[0].action !== 'createClaimBill') {
    throw new Error('Ready backend did not create directly: ' + JSON.stringify(posted));
  }

  return {
    firstUseActions:['initClaimBillSheets', 'createClaimBill'],
    readyActions:posted.map(payload => payload.action),
    vendor:createRequest.vendor,
    items:createRequest.items,
    hasMutationId:Boolean(createRequest.mutationId)
  };
}
