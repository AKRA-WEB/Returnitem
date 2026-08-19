const assert = require('assert');
const retClient = require('../js/supabase-returnitem-client.js');

async function runTests() {
  console.log('=== TESTING RETURNITEM SUPABASE API CLIENT ADAPTER ===\n');

  // 1. Record Damaged Stock Intake
  console.log('[1/4] Testing Damaged Stock Intake...');
  const intakeRes = await retClient.recordDamagedIntake({
    intakeDate: '2026-08-19',
    warehouse: 'W1',
    sku: 'FF21610104',
    productName: 'มายองเนส SE เบสท์ฟู้ดส์ (ลัง12x910g)',
    damagedQty: 20,
    unit: 'ลัง',
    vendor: 'บจก. เม่งฮง',
    receiver: 'Inspector Test',
    remark: 'ลังบุบจากการจัดส่ง'
  });
  assert.strictEqual(intakeRes.status, 'success');
  assert(intakeRes.stockId, 'Must return stockId');
  console.log(`  -> Recorded damaged stock ID: [${intakeRes.stockId}]`);

  // 2. Query Damaged Stock with available qty calculation
  console.log('\n[2/4] Testing getDamagedStocks query...');
  const stockList = await retClient.getDamagedStocks({ vendor: 'บจก. เม่งฮง' });
  assert.strictEqual(stockList.status, 'success');
  const targetStock = stockList.stocks.find(s => s.id === intakeRes.stockId);
  assert(targetStock, 'Must find created stock');
  assert.strictEqual(targetStock.availableQty, 20, 'Available qty must equal damaged qty initially');
  console.log(`  -> Found stock: [${targetStock.productName}] Damaged: ${targetStock.damagedQty}, Available: ${targetStock.availableQty}`);

  // 3. Create Claim Bill from Damaged Stock
  console.log('\n[3/4] Testing Claim Bill creation & allocation update...');
  const claimRes = await retClient.createClaimBill({
    claimNumber: 'CLM-TEST-' + Date.now(),
    claimDate: '2026-08-19',
    vendor: 'บจก. เม่งฮง',
    warehouse: 'W1',
    creator: 'Supervisor Test',
    remark: 'เคลมสินค้าชำรุดรอบทดสอบ',
    items: [
      {
        stockId: targetStock.id,
        sku: targetStock.sku,
        productName: targetStock.productName,
        claimQty: 8,
        unit: targetStock.unit
      }
    ]
  });
  assert.strictEqual(claimRes.status, 'success');
  console.log(`  -> Created Claim Bill [${claimRes.claimNumber}] ID: ${claimRes.billId}`);

  // 4. Verify updated available quantity after claim allocation
  console.log('\n[4/4] Verifying stock available quantity reduction...');
  const updatedStockList = await retClient.getDamagedStocks({ vendor: 'บจก. เม่งฮง' });
  const updatedTarget = updatedStockList.stocks.find(s => s.id === intakeRes.stockId);
  assert.strictEqual(updatedTarget.allocatedQty, 8, 'Allocated qty must now be 8');
  assert.strictEqual(updatedTarget.availableQty, 12, 'Available qty must be 12 (20 - 8)');
  console.log(`  -> Allocation verified: Damaged=${updatedTarget.damagedQty}, Allocated=${updatedTarget.allocatedQty}, Available=${updatedTarget.availableQty}`);

  console.log('\n🌟 RETURNITEM SUPABASE API CLIENT ADAPTER TESTS PASSED 100%! 🌟');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
