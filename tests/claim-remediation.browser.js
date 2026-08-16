async page => {
  let defaultResponseMode = 'full';
  await page.route('**/macros/s/**', async route => {
    const requestUrl = route.request().url();
    const callback = decodeURIComponent(((requestUrl.match(/[?&]callback=([^&]+)/) || [])[1] || ''));
    const action = decodeURIComponent(((requestUrl.match(/[?&]action=([^&]+)/) || [])[1] || ''));
    const billId = decodeURIComponent(((requestUrl.match(/[?&]billId=([^&]+)/) || [])[1] || ''));
    const data = action === 'getClaimBillForPrint'
      ? {
          claimBill:{ billId, vendor:'Vendor Browser Current', status:'แจ้งเคลมแล้ว', committedGeneration:'GEN-CURRENT' },
          claimBillLines:[{ lineId:'LINE-CURRENT', billId, sku:'SKU-CURRENT', name:'สินค้าจากเซิร์ฟเวอร์', qty:7, unit:'กล่อง', expDate:'20/08/2026', lineStatus:'Active' }]
        }
      : action === 'getClaimBillHistory'
      ? {
          claimBills: [{ billId:'CLB-OLDER', vendor:'Vendor Browser', status:'ปิดงานแล้ว', createdAt:'2026-07-01', claimType:'คืนสินค้า-ทำCN' }],
          claimBillLines: [{ lineId:'LINE-OLDER', billId:'CLB-OLDER', sku:'SKU-OLD', name:'สินค้าประวัติ', qty:1, unit:'ชิ้น', expDate:'15/08/2026', lineStatus:'Active' }],
          nextOffset:2,
          hasMore:false
        }
      : action === 'getProducts'
        ? { products:[] }
        : defaultResponseMode === 'warehouse-only'
          ? {
              products:[],
              claims:[{ id:'WH-CLAIM', sku:'SKU-WH', name:'สินค้ารอคลัง', qty:1, unit:'ชิ้น', whStatus:'ยังไม่รับ', status:'รอคลังรับของ' }],
              returns:[{ id:'WH-RETURN', status:'รอ QC', source:'ภายในคลัง' }],
              audits:[],
              claimStock:[], claimBills:[], claimBillLines:[], claimBillReady:false,
              claimBillAccess:false,
              claimBillAuthError:{ reason:'permission_denied', message:'ไม่มีสิทธิ์ดูบิลเคลม' },
              claimBillHistoryNextOffset:0,
              claimBillHistoryHasMore:false
            }
          : {
            products:[], claims:[], returns:[], audits:[], claimStock:[], claimBillReady:true,
            claimBills:[
              { billId:'CLB-RECENT', vendor:'Vendor Browser', status:'ปิดงานแล้ว', createdAt:'2026-08-15', claimType:'คืนสินค้า-ทำCN' },
              { billId:'CLB-NOTIFIED', vendor:'Vendor Browser', status:'แจ้งเคลมแล้ว', createdAt:'2026-08-16' }
            ],
            claimBillLines:[
              { lineId:'LINE-RECENT', billId:'CLB-RECENT', sku:'SKU-NEW', name:'สินค้าล่าสุด', qty:1, unit:'ชิ้น', expDate:'16/08/2026', lineStatus:'Active' },
              { lineId:'LINE-NOTIFIED', billId:'CLB-NOTIFIED', sku:'SKU-OPEN', name:'สินค้ารอผล', qty:1, unit:'ชิ้น', expDate:'', lineStatus:'Active' }
            ],
            claimBillHistoryNextOffset:1,
            claimBillHistoryHasMore:true
          };
    const response = action === 'getClaimBillForPrint' && billId === 'CLB-CANCELLED'
      ? { status:'error', reason:'claim_bill_cancelled', message:'ใบเคลมนี้ถูกยกเลิกแล้ว', data:{} }
      : { status:'success', data };
    await route.fulfill({ status:200, contentType:'application/javascript', body:callback + '(' + JSON.stringify(response) + ');' });
  });

  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForFunction(() => typeof activateTab === 'function' && !document.getElementById('global-loader').classList.contains('flex'));
  const protectedCacheSanitized = await page.evaluate(() => {
    const safe = cacheSafeActiveData({
      returns:[{ id:'SAFE-RETURN' }],
      claimBills:[{ billId:'LEAK-BILL' }],
      claimBillLines:[{ lineId:'LEAK-LINE' }],
      claimStock:[{ sku:'LEAK-STOCK' }],
      claimBillReady:true
    });
    return safe.returns.length === 1 && !('claimBills' in safe) && !('claimBillLines' in safe) && !('claimStock' in safe) && !('claimBillReady' in safe);
  });
  if (!protectedCacheSanitized) throw new Error('Protected claim data remained in the active cache payload');
  await page.evaluate(() => activateTab('TRACK_CLM'));

  const printButton = page.getByRole('button', { name:'พิมพ์ใบเคลม CLB-NOTIFIED' });
  if (!await printButton.isVisible()) throw new Error('Bill-specific accessible print control is not visible');
  await printButton.click();
  const printPreview = page.locator('#print-preview-overlay');
  await printPreview.waitFor({ state:'visible' });
  const printText = await page.locator('#print-document-content').innerText();
  if (!printText.includes('Vendor Browser Current') || !printText.includes('สินค้าจากเซิร์ฟเวอร์') || !printText.includes('7 กล่อง')) throw new Error('Bill print preview did not use the authoritative server payload');
  await printPreview.getByRole('button', { name:'ปิด' }).click();
  await printPreview.waitFor({ state:'hidden' });
  await page.evaluate(() => { executeBillPrintPreview('CLB-CANCELLED'); return true; });
  const cancelledPrintHeading = page.getByRole('heading', { name:'พิมพ์ไม่ได้' });
  await cancelledPrintHeading.waitFor({ state:'visible' });
  if (await printPreview.isVisible()) throw new Error('A stale tab was allowed to print a cancelled bill');
  await page.getByRole('button', { name:'OK' }).click();
  await cancelledPrintHeading.waitFor({ state:'hidden' });

  const loadMore = page.locator('#claim-history-load-more');
  if (!await loadMore.isVisible()) throw new Error('History pagination control is not visible');
  await loadMore.click();
  await page.waitForFunction(() => state.claimBills.some(bill => bill.billId === 'CLB-OLDER') && !state.claimBillHistoryHasMore);
  if (await loadMore.isVisible()) throw new Error('History pagination control remained visible after the final page');
  if (!await page.locator('#bill_done_list').getByText('CLB-OLDER').isVisible()) throw new Error('Older claim bill was not rendered');
  const historyBillCount = (await page.locator('#bill_done_list article').all()).length;

  await page.locator('[data-action="claim-bill-resolve"][data-bill-id="CLB-NOTIFIED"]').click();
  await page.locator('#bill-resolution').selectOption('คืนสินค้าหักใบบิล');
  await page.locator('#bill-resolution-amount').waitFor({ state:'visible' });
  await page.locator('#bill-resolution-ref').fill('INV-BROWSER-1');
  await page.locator('#bill-resolution-amount').fill('0');
  await page.getByRole('button', { name:'บันทึกผล' }).click();
  if (!await page.locator('.swal2-validation-message').isVisible()) throw new Error('Invalid bill deduction amount was accepted');
  await page.locator('#bill-resolution-amount').fill('120.50');
  await page.getByRole('button', { name:'Cancel' }).click();

  const deniedRead = await page.evaluate(() => {
    localStorage.setItem(activeCacheKey(), JSON.stringify({ _ts:Date.now(), _d:{ claimBills:[{ billId:'LEAK' }] } }));
    const handled = handleClaimBillAuthError({ reason:'permission_denied', message:'ไม่มีสิทธิ์ทดสอบ' });
    return {
      handled,
      cacheRemoved:localStorage.getItem(activeCacheKey()) === null,
      billsCleared:state.claimBills.length === 0 && state.claimBillLines.length === 0 && state.claimStock.length === 0
    };
  });
  if (!deniedRead.handled || !deniedRead.cacheRemoved || !deniedRead.billsCleared) throw new Error('Permission-denied reads were handled as normal cached data');
  const permissionHeading = page.getByRole('heading', { name:'ไม่มีสิทธิ์เข้าถึงข้อมูลเคลม' });
  if (!await permissionHeading.isVisible()) throw new Error('Permission-denied claim read was not surfaced to the user');
  await page.keyboard.press('Escape');
  await permissionHeading.waitFor({ state:'hidden' });

  defaultResponseMode = 'warehouse-only';
  await page.evaluate(() => fetchData(false));
  await page.waitForFunction(() => state.returns.some(item => item.id === 'WH-RETURN') && state.claims.some(item => item.id === 'WH-CLAIM'));
  const warehouseBootstrap = await page.evaluate(() => ({
    ordinaryDataPreserved:state.returns.some(item => item.id === 'WH-RETURN') && state.claims.some(item => item.id === 'WH-CLAIM'),
    protectedDataExcluded:state.claimBills.length === 0 && state.claimBillLines.length === 0 && state.claimStock.length === 0
  }));
  if (!warehouseBootstrap.ordinaryDataPreserved || !warehouseBootstrap.protectedDataExcluded) throw new Error('WH-only bootstrap did not preserve ordinary data while excluding protected claim data');
  if (await permissionHeading.isVisible()) throw new Error('Expected WH-only bootstrap denial opened a blocking modal');

  const authoritativeAdminBlocked = await page.evaluate(() => {
    appUser = { id:'revoked-admin', name:'Revoked Admin', roles:['ADMIN'], perms:{}, token:'CURRENT' };
    applyRolePermissions();
    const tabsHidden = Array.from(document.querySelectorAll('#desktop-nav [data-tab]')).every(button => button.style.display === 'none');
    return tabsHidden && !can('ADD_RET') && !can('MANAGE_CLM');
  });
  if (!authoritativeAdminBlocked) throw new Error('Authoritative-empty ADMIN still bypassed navigation or action permissions');

  const permissionContractPreserved = await page.evaluate(() => {
    const legacy = buildVerifiedSessionUser({ id:'legacy-user', name:'Legacy User', roles:['TRD'] }, 'LEGACY');
    const current = buildVerifiedSessionUser({ id:'current-user', name:'Current User', roles:['ADMIN'], perms:{} }, 'CURRENT');
    return !Object.prototype.hasOwnProperty.call(legacy, 'perms')
      && Object.prototype.hasOwnProperty.call(current, 'perms')
      && Object.keys(current.perms).length === 0;
  });
  if (!permissionContractPreserved) throw new Error('Verified session normalization changed the permission-contract presence');

  const fractionalQuantities = await page.evaluate(() => {
    const tinyTotal = formatClaimUnitTotals([{ qty:0.0004, unit:'กก.' }], 'qty');
    const merged = mergeClaimBillLines([
      { sourceClaimId:'SRC-FRACTION', sku:'SKU-FRACTION', name:'Fraction', qty:0.1, unit:'กก.' },
      { sourceClaimId:'SRC-FRACTION', sku:'SKU-FRACTION', name:'Fraction', qty:0.2, unit:'กก.' }
    ]);
    return { tinyTotal, mergedQty:merged[0] && merged[0].qty };
  });
  if (fractionalQuantities.tinyTotal !== '0.0004 กก.' || fractionalQuantities.mergedQty !== 0.3) {
    throw new Error('Six-decimal claim quantities were rounded or exposed floating artifacts');
  }

  await page.setViewportSize({ width:390, height:844 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (mobileOverflow) throw new Error('Tracking view overflows horizontally on mobile');

  return {
    historyBills:historyBillCount,
    authoritativePrint:true,
    resolutionAmountValidated:true,
    permissionDeniedHandled:true,
    authoritativeAdminBlocked:true,
    permissionContractPreserved,
    fractionalQuantities,
    protectedCacheSanitized,
    warehouseBootstrap,
    mobileOverflow
  };
}
