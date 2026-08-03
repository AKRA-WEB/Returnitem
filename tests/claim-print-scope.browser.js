async (page) => {
  const result = await page.evaluate(() => {
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
      }
    ];

    document.getElementById("tab-DASHBOARD").classList.remove("active");
    renderUI();

    const waitButton = document.querySelector("#track_wait_list [data-action='print-track']");
    const waitIds = parseClaimIds(waitButton.dataset.claimIds);
    const manageIds = parseClaimIds(document.querySelector("#manage_acc [data-action='print']").dataset.claimIds);
    waitButton.click();
    const previewSkus = Array.from(
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
      waitIds,
      manageIds,
      previewSkus,
      doneCards: document.querySelectorAll("#track_done_list > .glass-card").length,
      doneScopes,
      donePreviewSkus
    };
  });

  if (JSON.stringify(result.waitIds) !== JSON.stringify(["CLM-NEW"])) {
    throw new Error(`Waiting-card scope is wrong: ${JSON.stringify(result.waitIds)}`);
  }
  if (JSON.stringify(result.previewSkus) !== JSON.stringify(["NEW-1"])) {
    throw new Error(`Preview mixed old and new claims: ${JSON.stringify(result.previewSkus)}`);
  }
  if (JSON.stringify(result.manageIds) !== JSON.stringify(["CLM-NEW"])) {
    throw new Error(`Manage claim card mixed claim rounds: ${JSON.stringify(result.manageIds)}`);
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
