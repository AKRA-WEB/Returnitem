async (page) => {
  await page.route('**/macros/s/**', async route => {
    const requestUrl = route.request().url();
    const callback = decodeURIComponent(((requestUrl.match(/[?&]callback=([^&]+)/) || [])[1] || ''));
    const action = decodeURIComponent(((requestUrl.match(/[?&]action=([^&]+)/) || [])[1] || ''));
    if (action !== 'getClaimBillForPrint') return route.continue();
    const billId = decodeURIComponent(((requestUrl.match(/[?&]billId=([^&]+)/) || [])[1] || ''));
    const data = {
      claimBill:{ billId, vendor:'Vendor A', status:'พร้อมส่งเคลม' },
      claimBillLines:[{ lineId:'LINE-NEW-1', billId, sourceClaimId:'CLM-NEW-BILL', sku:'BILL-1', name:'สินค้าในบิลใหม่', qty:1, unit:'ชิ้น', reason:'new bill', remark:'-', lineStatus:'Active' }]
    };
    await route.fulfill({ status:200, contentType:'application/javascript', body:callback + '(' + JSON.stringify({ status:'success', data }) + ');' });
  });
  const result = await page.evaluate(async () => {
    appUser = { id:'manage-print-user', name:'Manage Print User', roles:['AKRA'], perms:{ 'app-ret':['MANAGE_CLM'] }, token:'MANAGE_TOKEN' };
    state.claims = [
      {
        id: "CLM-OLD-1",
        vendor: "Vendor A",
        status: "เคลมแล้ว",
        whStatus: "รับเข้าแล้ว",
        sku: "OLD-1",
        name: "ของเก่า 1",
        qty: 1,
        unit: "ชิ้น",
        reason: "old",
        remark: "-",
        reportDate: "15/06/2026",
        returnDate: "01/07/2026",
        claimType: "คืนสินค้า-ทำCN",
        claimBillNo: "-",
        claimAmount: "-"
      },
      {
        id: "CLM-OLD-2",
        vendor: "Vendor A",
        status: "เคลมแล้ว",
        whStatus: "รับเข้าแล้ว",
        sku: "OLD-2",
        name: "ของเก่า 2",
        qty: 1,
        unit: "ชิ้น",
        reason: "old",
        remark: "-",
        reportDate: "20/06/2026",
        returnDate: "15/07/2026",
        claimType: "คืนสินค้า-ทำCN",
        claimBillNo: "-",
        claimAmount: "-"
      },
      {
        id: "CLM-NEW",
        vendor: "Vendor A",
        status: "รอเคลม",
        whStatus: "รับเข้าแล้ว",
        sku: "NEW-1",
        name: "ของใหม่",
        qty: 1,
        unit: "ชิ้น",
        reason: "new",
        remark: "-",
        reportDate: "01/08/2026",
        returnDate: "",
        claimType: "",
        claimBillNo: "",
        claimAmount: ""
      },
      {
        id: "CLM-PROCESS",
        vendor: "Vendor A",
        status: "แจ้งเคลมแล้ว",
        whStatus: "รับเข้าแล้ว",
        sku: "PROCESS-1",
        name: "ของรอบเดิมที่แจ้งแล้ว",
        qty: 1,
        unit: "ชิ้น",
        reason: "process",
        remark: "-",
        reportDate: "25/07/2026",
        returnDate: "",
        claimType: "",
        claimBillNo: "",
        claimAmount: ""
      },
      {
        id: "CLM-PROCESS-2",
        vendor: "Vendor A",
        status: "แจ้งเคลมแล้ว",
        whStatus: "รับเข้าแล้ว",
        sku: "PROCESS-2",
        name: "ของรอบเดิมคนละหน่วย",
        qty: 2,
        unit: "ลัง",
        reason: "process",
        remark: "-",
        reportDate: "25/07/2026",
        returnDate: "",
        claimType: "",
        claimBillNo: "",
        claimAmount: ""
      }
    ];
    state.claimBillReady = true;
    state.claimStock = [{
      vendor: "Vendor A",
      sku: "NEW-1",
      name: "ของใหม่",
      unit: "ชิ้น",
      receivedQty: 1,
      allocatedQty: 0,
      availableQty: 1
    }];
    state.claimBills = [{
      billId: "CLB-NEW-1",
      vendor: "Vendor A",
      status: "พร้อมส่งเคลม",
      createdAt: "2026-08-15 12:00:00",
      createdBy: "Admin"
    }];
    state.claimBillLines = [{
      lineId: "LINE-NEW-1",
      billId: "CLB-NEW-1",
      sourceClaimId: "CLM-NEW-BILL",
      sku: "BILL-1",
      name: "สินค้าในบิลใหม่",
      qty: 1,
      unit: "ชิ้น",
      reason: "new bill",
      remark: "-",
      lineStatus: "Active"
    }];

    document.getElementById("tab-DASHBOARD").classList.remove("active");
    renderUI();

    const stockInput = document.querySelector("#manage_acc input[name='claimQty']");
    await executeBillPrintPreview("CLB-NEW-1");
    const billPreviewSkus = Array.from(
      document.querySelectorAll("#print-document-content tbody tr td:nth-child(2)"),
      cell => cell.textContent.trim()
    );
    const billReference = document.getElementById("print-document-content").textContent.includes("CLB-NEW-1");

    const legacyProcessButton = document.querySelector("#track_process_list [data-action='print-track']");
    const legacyProcessIds = parseClaimIds(legacyProcessButton.dataset.claimIds);
    const legacyProcessTotalPerUnit = document.querySelector("#track_process_list > .glass-card").textContent.includes("1 ชิ้น · 2 ลัง");
    legacyProcessButton.click();
    const legacyProcessSkus = Array.from(
      document.querySelectorAll("#print-document-content tbody tr td:nth-child(2)"),
      cell => cell.textContent.trim()
    );
    const doneButtons = Array.from(document.querySelectorAll("#track_done_list [data-action='print-track']"));
    const doneScopes = doneButtons.map(button => parseClaimIds(button.dataset.claimIds));
    const donePreviewSkus = doneButtons.map(button => {
      button.click();
      return Array.from(
        document.querySelectorAll("#print-document-content tbody tr td:nth-child(2)"),
        cell => cell.textContent.trim()
      );
    });
    document.getElementById("print-preview-overlay").classList.add("hidden");
    activateTab("TRACK_CLM");

    return {
      stockMax: stockInput && stockInput.max,
      billPreviewSkus,
      billReference,
      legacyWaitCards: document.querySelectorAll("#track_wait_list > .glass-card").length,
      legacyProcessIds,
      legacyProcessTotalPerUnit,
      legacyProcessSkus,
      doneCards: document.querySelectorAll("#track_done_list > .glass-card").length,
      doneScopes,
      donePreviewSkus
    };
  });

  if (result.stockMax !== "1") {
    throw new Error(`Opening stock quantity is wrong: ${result.stockMax}`);
  }
  if (JSON.stringify(result.billPreviewSkus) !== JSON.stringify(["BILL-1"]) || !result.billReference) {
    throw new Error(`New bill preview is not durable/exact: ${JSON.stringify(result)}`);
  }
  if (result.legacyWaitCards !== 0) {
    throw new Error(`Opening stock leaked into legacy waiting cards: ${result.legacyWaitCards}`);
  }
  if (JSON.stringify(result.legacyProcessIds) !== JSON.stringify(["CLM-PROCESS", "CLM-PROCESS-2"]) || JSON.stringify(result.legacyProcessSkus) !== JSON.stringify(["PROCESS-1", "PROCESS-2"]) || !result.legacyProcessTotalPerUnit) {
    throw new Error(`Legacy process scope is wrong: ${JSON.stringify(result)}`);
  }
  if (result.doneCards !== 2) {
    throw new Error(`Expected 2 completed claim cards, received ${result.doneCards}`);
  }
  const completedIds = result.doneScopes.flat().sort();
  if (JSON.stringify(completedIds) !== JSON.stringify(["CLM-OLD-1", "CLM-OLD-2"])) {
    throw new Error(`Completed print scopes are mixed: ${JSON.stringify(result.doneScopes)}`);
  }
  const completedPreviewSkus = result.donePreviewSkus.flat().sort();
  if (
    !result.donePreviewSkus.every(skus => skus.length === 1) ||
    JSON.stringify(completedPreviewSkus) !== JSON.stringify(["OLD-1", "OLD-2"])
  ) {
    throw new Error(`Completed previews are mixed: ${JSON.stringify(result.donePreviewSkus)}`);
  }

  return result;
}
