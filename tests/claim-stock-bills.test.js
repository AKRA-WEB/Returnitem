const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryRange {
  constructor(sheet, row, column, numRows = 1, numColumns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    this.sheet.readLog.push({ row:this.row, column:this.column, numRows:this.numRows, numColumns:this.numColumns });
    const values = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const source = this.sheet.rows[this.row - 1 + r] || [];
      const line = [];
      for (let c = 0; c < this.numColumns; c += 1) line.push(source[this.column - 1 + c] ?? '');
      values.push(line);
    }
    return values;
  }

  setValues(values) {
    values.forEach((line, r) => line.forEach((value, c) => this.sheet.setCell(this.row + r, this.column + c, value)));
    return this;
  }

  getValue() {
    return this.getValues()[0][0];
  }

  setValue(value) {
    this.sheet.setCell(this.row, this.column, value);
    return this;
  }

  clearContent() {
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numColumns; c += 1) this.sheet.setCell(this.row + r, this.column + c, '');
    }
    return this;
  }

  clearDataValidations() {
    return this;
  }
}

class MemorySheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map(row => row.slice());
    this.readLog = [];
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    return this.rows.length;
  }

  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getDataRange() {
    return new MemoryRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }

  getRange(row, column, numRows = 1, numColumns = 1) {
    return new MemoryRange(this, row, column, numRows, numColumns);
  }

  appendRow(row) {
    this.rows.push(row.slice());
  }

  setCell(row, column, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < column) this.rows[row - 1].push('');
    this.rows[row - 1][column - 1] = value;
  }
}

class MemorySpreadsheet {
  constructor(sheets) {
    this.sheets = new Map(sheets.map(sheet => [sheet.getName(), sheet]));
  }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }

  getSheets() {
    return Array.from(this.sheets.values());
  }

  insertSheet(name) {
    const sheet = new MemorySheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

function claimRow({ date, sku, name, qty, unit, vendor, status, id, whStatus = 'รับเข้าแล้ว', reason = 'ชำรุด' }) {
  return [date, 'WH', 'A1', sku, name, qty, unit, '', whStatus, vendor, status, '', '', '', '', reason, '', '', '', '', 'คลัง', id, '', 'User', 'AKRA'];
}

const claimHeaders = [
  'Report Date', 'WH Receiver', 'WH Location', 'SKU', 'Product Name', 'Qty', 'Unit', 'Unused',
  'WH Status', 'Vendor', 'Status', 'Return Date', 'Unused 2', 'Unused 3', 'Unused 4', 'Reason',
  'Remark', 'Claim Type', 'Claim Bill No', 'Claim Amount', 'Found Location', 'ID', 'Exp Date', 'Reporter', 'Route'
];
const billHeaders = [
  'BillID', 'Vendor', 'Status', 'CreatedAt', 'CreatedBy', 'MutationID', 'LastMutationID', 'NotifiedAt', 'NotifiedBy',
  'ClaimType', 'ClaimBillNo', 'ClaimAmount', 'ClosedAt', 'ClosedBy', 'CancelledAt', 'CancelledBy',
  'CancelReason', 'UpdatedAt', 'UpdatedBy'
];
const lineHeaders = [
  'LineID', 'BillID', 'SourceClaimID', 'SKU', 'ProductName', 'Qty', 'Unit', 'Reason', 'Remark',
  'ExpDate', 'LineStatus', 'CreatedAt', 'CreatedBy', 'VoidedAt', 'VoidedBy'
];
const mutationHeaders = ['MutationID', 'Action', 'TargetID', 'State', 'RequestJSON', 'ResultJSON', 'CreatedAt', 'CreatedBy', 'CommittedAt'];

const sheets = [
  new MemorySheet('Damage Goods Report', [
    claimHeaders,
    claimRow({ date: '01/08/2026', sku: 'SKU-1', name: 'แป้งดาว', qty: 30, unit: 'ลัง', vendor: 'Vendor A', status: 'รอเคลม', id: 'SRC-OLD' }),
    claimRow({ date: '02/08/2026', sku: 'SKU-1', name: 'แป้งดาว', qty: 20, unit: 'ลัง', vendor: 'Vendor A', status: 'รอเคลม', id: 'SRC-NEW' }),
    claimRow({ date: '02/08/2026', sku: 'SKU-2', name: 'สินค้าไม่มี Vendor', qty: 5, unit: 'ลัง', vendor: 'ไม่ระบุ Vendor', status: 'รอเคลม', id: 'SRC-NO-VENDOR' }),
    claimRow({ date: '02/08/2026', sku: 'SKU-3', name: 'สินค้าทดสอบ Recovery', qty: 8, unit: 'ลัง', vendor: 'Vendor C', status: 'รอเคลม', id: 'SRC-RECOVERY' }),
    claimRow({ date: '02/08/2026', sku: 'SKU-4', name: 'สินค้าทดสอบ Commit', qty: 4, unit: 'ลัง', vendor: 'Vendor D', status: 'รอเคลม', id: 'SRC-COMMIT' }),
    claimRow({ date: '02/08/2026', sku: 'SKU-5', name: 'สินค้าทดสอบ Vendor Recovery', qty: 2, unit: 'ลัง', vendor: 'ไม่ระบุ Vendor', status: 'รอเคลม', id: 'SRC-VENDOR-1' }),
    claimRow({ date: '03/08/2026', sku: 'SKU-5', name: 'สินค้าทดสอบ Vendor Recovery', qty: 3, unit: 'ลัง', vendor: 'ไม่ระบุ Vendor', status: 'รอเคลม', id: 'SRC-VENDOR-2' }),
    claimRow({ date: '03/08/2026', sku: 'SKU-1', name: 'ของรอบเดิม', qty: 99, unit: 'ลัง', vendor: 'Vendor A', status: 'แจ้งเคลมแล้ว', id: 'SRC-LEGACY' })
  ]),
  new MemorySheet('ProductName', [['SKU', 'Product Name', '', 'Unit', '', 'Vendor'], ['SKU-1', 'แป้งดาว', '', 'ลัง', '', 'Vendor A'], ['SKU-2', 'สินค้าไม่มี Vendor', '', 'ลัง', '', 'ไม่ระบุ Vendor'], ['SKU-3', 'สินค้าทดสอบ Recovery', '', 'ลัง', '', 'Vendor C'], ['SKU-4', 'สินค้าทดสอบ Commit', '', 'ลัง', '', 'Vendor D'], ['SKU-5', 'สินค้าทดสอบ Vendor Recovery', '', 'ลัง', '', 'ไม่ระบุ Vendor']]),
  new MemorySheet('Return Record', [['ID']]),
  new MemorySheet('AuditTask', [['TaskID']]),
  new MemorySheet('ClaimBill', [billHeaders]),
  new MemorySheet('ClaimBillLine', [lineHeaders]),
  new MemorySheet('ClaimMutation', [mutationHeaders])
];
const spreadsheet = new MemorySpreadsheet(sheets);

class TextOutput {
  constructor(text) {
    this.text = text;
  }

  setMimeType() {
    return this;
  }

  getContent() {
    return this.text;
  }

  getContentText() {
    return this.text;
  }
}

const context = {
  console,
  Date,
  JSON,
  Math,
  String,
  Number,
  Array,
  Object,
  Error,
  ContentService: {
    MimeType: { JSON: 'json', JAVASCRIPT: 'javascript' },
    createTextOutput: text => new TextOutput(text)
  },
  SpreadsheetApp: {
    openById: () => spreadsheet,
    flush: () => {}
  },
  Utilities: {
    formatDate: (value, zone, format) => format === 'HH:mm' ? '12:00' : format === 'yyyyMMdd-HHmmss' ? '20260815-120000' : format === 'yyyy-MM-dd HH:mm:ss' ? '2026-08-16 09:00:00' : '15/08/2026',
    getUuid: (() => { let next = 1; return () => `UUID-${String(next++).padStart(4, '0')}`; })()
  },
  LockService: {
    getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
  },
  UrlFetchApp: {
    fetch: url => {
      if (!url.includes('appId=app-damage')) {
        return new TextOutput(JSON.stringify({ valid: false, reason: 'permission_denied' }));
      }
      return new TextOutput(JSON.stringify(url.includes('token=NO_ENTRY_ACCESS') ? {
      valid: false,
      reason: 'permission_denied'
    } : url.includes('token=VALID_TOKEN') ? {
      valid: true,
      user: { id: 'verified-id', name: 'Verified User', roles: ['ADMIN'], perms: { 'app-ret': ['ADD_RET', 'QC_RET', 'ADD_CLM', 'MANAGE_CLM', 'TRACK_CLM', 'WH_CLM'] } }
    } : url.includes('token=RENAMED_VALID_TOKEN') ? {
      valid: true,
      user: { id: 'verified-id', name: 'Renamed Verified User', roles: ['ADMIN'], perms: { 'app-ret': ['ADD_RET', 'QC_RET', 'MANAGE_CLM', 'TRACK_CLM', 'WH_CLM'] } }
    } : url.includes('token=EMPTY_PERMS') ? {
      valid: true,
      user: { name: 'Revoked User', roles: ['TRD'], perms: {} }
    } : url.includes('token=ADMIN_EMPTY_PERMS') ? {
      valid: true,
      user: { name: 'Revoked Admin', roles: ['ADMIN'], perms: {} }
    } : url.includes('token=SUPERVISOR_EMPTY_PERMS') ? {
      valid: true,
      user: { name: 'Revoked Supervisor', roles: ['SUPERVISOR'], perms: { 'app-ret': [] } }
    } : url.includes('token=LEGACY_TOKEN') ? {
      valid: true,
      user: { name: 'Legacy User', roles: ['TRD'] }
    } : url.includes('token=READ_ONLY') ? {
      valid: true,
      user: { name: 'Read Only', roles: ['WAREHOUSE'], perms: { 'app-ret': ['ADD_CLM'] } }
    } : url.includes('token=WH_ONLY') ? {
      valid: true,
      user: { id: 'warehouse-only', name: 'Warehouse Only', roles: ['AKRA'], perms: { 'app-ret': ['WH_CLM'] } }
    } : url.includes('token=TRACK_ONLY') ? {
      valid: true,
      user: { id: 'tracking-only', name: 'Tracking Only', roles: ['SUPERVISOR'], perms: { 'app-ret': ['TRACK_CLM'] } }
    } : url.includes('token=SPLIT_ADD_ONLY') ? {
      valid: true,
      user: { id: 'split-user', name: 'Split User', roles: ['TRD'], perms: { 'app-ret': ['ADD_RET'] } }
    } : { valid: false, reason: 'invalid_or_expired_token' }));
    }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs.txt'), 'utf8'), context, { filename: 'Code.gs.txt' });

function post(payload) {
  const output = context.doPost({ postData: { contents: JSON.stringify({ token: 'VALID_TOKEN', ...payload }) } });
  return JSON.parse(output.getContent());
}

function postRaw(payload) {
  const output = context.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(output.getContent());
}

assert.strictEqual(
  postRaw({ token:'VALID_TOKEN', action:'initClaimBillSheets' }).status,
  'success',
  'protected Returnitem actions must verify the app-damage entry while reading granular permissions from app-ret'
);
assert.deepStrictEqual(
  postRaw({ token:'NO_ENTRY_ACCESS', action:'initClaimBillSheets' }),
  { status:'error', message:'ไม่มีสิทธิ์เข้าใช้งานแอปส่งคืนและเคลมสินค้า', reason:'permission_denied' },
  'Main entry denial must stay permission_denied instead of being reported as an expired session'
);

const intakeDraft = {
  id:'SRC-DRAFT-IDEMPOTENT', reportDate:'16/08/2026', sku:'SKU-DRAFT', name:'สินค้าทดสอบรับเข้า', qty:2,
  unit:'ชิ้น', vendor:'Vendor Draft', reason:'ชำรุด', remark:'ทดสอบ retry', foundLocation:'A1', expDate:'', reporter:'Spoofed User', route:'AKRA'
};
const intakeRowsBefore = spreadsheet.getSheetByName('Damage Goods Report').rows.length;
assert.strictEqual(post({ action:'addDrafts', drafts:[intakeDraft] }).status, 'success', 'first damaged-goods intake must succeed');
assert.strictEqual(post({ action:'addDrafts', drafts:[intakeDraft] }).status, 'success', 'same damaged-goods intake retry must reconcile');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').rows.length, intakeRowsBefore + 1, 'same draft ID retry must append one source row');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').rows.filter(row => row[21] === intakeDraft.id).length, 1, 'SourceClaimID must stay unique after retry');
assert.strictEqual(post({ action:'addDrafts', drafts:[{ ...intakeDraft, qty:3 }] }).status, 'error', 'conflicting reuse of a draft ID must reject');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').rows.find(row => row[21] === intakeDraft.id)[5], 2, 'conflicting retry must preserve the original quantity');
assert.strictEqual(post({ action:'addDrafts', drafts:[{ ...intakeDraft, vendor:'Different Vendor' }] }).status, 'error', 'same draft ID with a different Vendor must not reconcile as an exact retry');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').rows.find(row => row[21] === intakeDraft.id)[23], 'Verified User', 'backend must derive the intake reporter from the verified token');
const duplicateIntakeRow = spreadsheet.getSheetByName('Damage Goods Report').rows.find(row => row[21] === intakeDraft.id).slice();
spreadsheet.getSheetByName('Damage Goods Report').rows.push(duplicateIntakeRow);
assert.strictEqual(post({ action:'initClaimBillSheets' }).status, 'error', 'rollout initialization must stop when duplicate SourceClaimIDs already exist');
spreadsheet.getSheetByName('Damage Goods Report').rows.pop();

function readClaimData() {
  const output = context.doGet({ parameter: { includeProducts: '0', token: 'VALID_TOKEN' } });
  return JSON.parse(output.getContent()).data;
}

function readPublicClaimData() {
  const output = context.doGet({ parameter: { includeProducts: '0' } });
  return JSON.parse(output.getContent()).data;
}

function readClaimHistory(parameters = {}) {
  const output = context.doGet({ parameter: { action: 'getClaimBillHistory', token: 'VALID_TOKEN', ...parameters } });
  return JSON.parse(output.getContent());
}

function readClaimBillForPrint(billId, token = 'VALID_TOKEN') {
  const output = context.doGet({ parameter: { action:'getClaimBillForPrint', billId, includeProducts:'0', token } });
  return JSON.parse(output.getContent());
}

function billRows() {
  return spreadsheet.getSheetByName('ClaimBill').rows.slice(1).filter(row => row[0]);
}

function activeLineRows() {
  return spreadsheet.getSheetByName('ClaimBillLine').rows.slice(1).filter(row => row[0] && String(row[10]).startsWith('Generation:'));
}

const first = post({
  action: 'createClaimBill',
  vendor: 'Vendor A',
  items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 35 }],
  mutationId: 'MUT-001',
  user: 'Admin'
});
assert.strictEqual(first.status, 'success', first.message);
assert.ok(first.data && first.data.billId, 'createClaimBill must return a Bill ID');
const printableFirst = readClaimBillForPrint(first.data.billId);
assert.strictEqual(printableFirst.status, 'success', printableFirst.message);
assert.ok(printableFirst.data && printableFirst.data.claimBill, 'authoritative print read must return a bill payload');
assert.strictEqual(printableFirst.data.claimBill.billId, first.data.billId, 'authoritative print read must return the exact bill');
assert.deepStrictEqual(printableFirst.data.claimBillLines.map(line => [line.sourceClaimId, line.qty]), [['SRC-OLD', 30], ['SRC-NEW', 5]], 'authoritative print read must return only the committed line generation');
assert.strictEqual(billRows()[0][4], 'Verified User', 'backend must derive actor from verified token instead of trusting payload user');
assert.deepStrictEqual(activeLineRows().map(row => [row[2], row[5]]), [['SRC-OLD', 30], ['SRC-NEW', 5]], 'FIFO must consume the oldest source first');
assert.strictEqual(post({ action: 'deleteClaim', id: 'SRC-OLD' }).status, 'error', 'allocated source rows must not be deleted');
assert.strictEqual(post({ action: 'updateVendor', claimId: 'SRC-OLD', sku: 'SKU-1', vendor: 'Vendor Z' }).status, 'error', 'allocated source Vendor must not change');
assert.strictEqual(post({ action: 'bulkUpdateStatus', ids: ['SRC-OLD'], status: 'สำเร็จแล้ว', isFinancial: false }).status, 'error', 'legacy status changes must not mutate allocated source rows');

let claimData = readClaimData();
assert.strictEqual(claimData.claimBillRevision, '20260816.08-claim-bills');
assert.deepStrictEqual(JSON.parse(JSON.stringify(claimData.claimStock.find(item => item.sku === 'SKU-1'))), {
  vendor: 'Vendor A', sku: 'SKU-1', name: 'แป้งดาว', unit: 'ลัง', receivedQty: 50, allocatedQty: 35, availableQty: 15
}, 'legacy notified rows must not enter stock and available quantity must be derived');

const retry = post({
  action: 'createClaimBill',
  vendor: 'Vendor A',
  items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 35 }],
  mutationId: 'MUT-001',
  user: 'Admin'
});
assert.strictEqual(retry.status, 'success');
assert.strictEqual(retry.data.billId, first.data.billId, 'same mutation must return the original bill');
assert.strictEqual(billRows().length, 1, 'idempotent retry must not append a second bill');

const over = post({
  action: 'createClaimBill',
  vendor: 'Vendor A',
  items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 16 }],
  mutationId: 'MUT-OVER',
  user: 'Admin'
});
assert.strictEqual(over.status, 'error', 'over-allocation must be rejected');
assert.strictEqual(billRows().length, 1);
assert.strictEqual(post({ action: 'createClaimBill', vendor: 'Vendor A', items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 0.0000001 }], mutationId: 'MUT-TINY' }).status, 'error', 'quantities rounded to zero must be rejected');

const second = post({
  action: 'createClaimBill',
  vendor: 'Vendor A',
  items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 10 }],
  mutationId: 'MUT-002',
  user: 'Admin'
});
assert.strictEqual(second.status, 'success', second.message);
assert.notStrictEqual(second.data.billId, first.data.billId, 'same Vendor can have independent bills');

const edit = post({
  action: 'updateClaimBillItems',
  billId: second.data.billId,
  items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 5 }],
  mutationId: 'MUT-EDIT-002',
  user: 'Admin'
});
assert.strictEqual(edit.status, 'success', edit.message);
claimData = readClaimData();
assert.strictEqual(claimData.claimStock.find(item => item.sku === 'SKU-1').availableQty, 10, 'editing a ready bill must apply only the allocation delta');

const notify = post({ action: 'updateClaimBillStatus', billId: first.data.billId, status: 'แจ้งเคลมแล้ว', mutationId: 'MUT-NOTIFY-001', user: 'Admin' });
assert.strictEqual(notify.status, 'success', notify.message);
assert.strictEqual(billRows().find(row => row[0] === second.data.billId)[2], 'พร้อมส่งเคลม', 'same-Vendor sibling bill must remain unchanged');

const blockedEdit = post({
  action: 'updateClaimBillItems',
  billId: first.data.billId,
  items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 30 }],
  mutationId: 'MUT-EDIT-BLOCKED',
  user: 'Admin'
});
assert.strictEqual(blockedEdit.status, 'error', 'notified bill quantities must be immutable');
const closeFirst = post({ action: 'updateClaimBillStatus', billId: first.data.billId, status: 'ปิดงานแล้ว', claimType: 'คืนสินค้า-ทำCN', mutationId: 'MUT-CLOSE-001' });
assert.strictEqual(closeFirst.status, 'success', closeFirst.message);
const oldNotifyRetry = post({ action: 'updateClaimBillStatus', billId: first.data.billId, status: 'แจ้งเคลมแล้ว', mutationId: 'MUT-NOTIFY-001', user: 'Spoofed Retry' });
assert.strictEqual(oldNotifyRetry.status, 'success', 'durable mutation ledger must answer an older retry after a later mutation');
assert.strictEqual(billRows().find(row => row[0] === first.data.billId)[2], 'ปิดงานแล้ว', 'older retries must not roll bill state backward');

const cancelled = post({ action: 'cancelClaimBill', billId: second.data.billId, reason: 'Vendor รับไม่ครบ', mutationId: 'MUT-CANCEL-002', user: 'Admin' });
assert.strictEqual(cancelled.status, 'success', cancelled.message);
const cancelledPrint = readClaimBillForPrint(second.data.billId);
assert.strictEqual(cancelledPrint.status, 'error', 'cancelled bills must fail the authoritative print read');
assert.strictEqual(cancelledPrint.reason, 'claim_bill_cancelled');
claimData = readClaimData();
assert.strictEqual(claimData.claimStock.find(item => item.sku === 'SKU-1').availableQty, 15, 'cancelling a ready bill must release its quantity');
const matchingCancellation = post({ action:'cancelClaimBill', billId:second.data.billId, reason:'Vendor รับไม่ครบ', mutationId:'MUT-CANCEL-MATCH' });
assert.strictEqual(matchingCancellation.status, 'success', 'an exact cancellation retry may reconcile under a replacement mutation ID');
assert.strictEqual(matchingCancellation.data.idempotent, true, 'an exact cancellation retry must report idempotent reconciliation');
const conflictingCancellation = post({ action:'cancelClaimBill', billId:second.data.billId, reason:'เหตุผลใหม่ที่ไม่ตรง', mutationId:'MUT-CANCEL-CONFLICT' });
assert.strictEqual(conflictingCancellation.status, 'error', 'an already-cancelled bill must reject a new request with a conflicting reason');
assert.strictEqual(billRows().find(row => row[0] === second.data.billId)[16], 'Vendor รับไม่ครบ', 'a conflicting cancellation retry must preserve the audited reason');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-CANCEL-CONFLICT')[3], 'Failed', 'a conflicting cancellation retry must not be recorded as committed');
const matchingPreparedCancelRequest = context.mutationRequestJson_('cancelClaimBill', { billId:second.data.billId, reason:'Vendor รับไม่ครบ' });
const conflictingPreparedCancelRequest = context.mutationRequestJson_('cancelClaimBill', { billId:second.data.billId, reason:'เหตุผลค้างที่ไม่ตรง' });
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-CANCEL-PREPARED-MATCH', 'cancelClaimBill', second.data.billId, 'Prepared', matchingPreparedCancelRequest, '', '2026-08-16 09:00:00', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-CANCEL-PREPARED-CONFLICT', 'cancelClaimBill', second.data.billId, 'Prepared', conflictingPreparedCancelRequest, '', '2026-08-16 09:00:00', 'Verified User', '']);
assert.strictEqual(post({ action:'cancelClaimBill', billId:second.data.billId, reason:'Vendor รับไม่ครบ', mutationId:'MUT-CANCEL-RECONCILE-TRIGGER' }).status, 'success', 'an exact cancellation retry must reconcile stranded Prepared ledgers');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-CANCEL-PREPARED-MATCH')[3], 'Committed', 'a matching Prepared cancellation must reconcile as committed');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-CANCEL-PREPARED-CONFLICT')[3], 'Failed', 'a conflicting Prepared cancellation must reconcile as failed');

const blockedCancel = post({ action: 'cancelClaimBill', billId: first.data.billId, reason: 'ลองยกเลิก', mutationId: 'MUT-CANCEL-BLOCKED', user: 'Admin' });
assert.strictEqual(blockedCancel.status, 'error', 'notified bills must not be cancellable');

assert.strictEqual(post({ action: 'bulkUpdateStatus', ids: ['SRC-NO-VENDOR'], status: 'แจ้งเคลมแล้ว', isFinancial: false }).status, 'error', 'unallocated opening stock must not bypass durable claim bills through legacy bulk status');
const assigned = post({ action: 'assignStockVendor', sku: 'SKU-2', unit: 'ลัง', vendor: 'Vendor B', mutationId: 'MUT-VENDOR-002', user: 'Spoofed User' });
assert.strictEqual(assigned.status, 'success', assigned.message);
assert.strictEqual(spreadsheet.getSheetByName('ProductName').rows[2][5], 'Vendor B', 'Vendor assignment must update ProductName');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').rows[3][9], 'Vendor B', 'Vendor assignment must update all matching unassigned stock rows');
assert.strictEqual(readClaimData().claimStock.find(item => item.sku === 'SKU-2').vendor, 'Vendor B');
const staleVendorAssignment = post({ action: 'assignStockVendor', sku: 'SKU-2', unit: 'ลัง', vendor: 'Vendor C', mutationId: 'MUT-VENDOR-STALE' });
assert.strictEqual(staleVendorAssignment.status, 'error', 'a stale conflicting Vendor assignment must be rejected');
assert.strictEqual(spreadsheet.getSheetByName('ProductName').rows[2][5], 'Vendor B', 'a rejected Vendor assignment must not change ProductName');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').rows[3][9], 'Vendor B', 'a rejected Vendor assignment must leave source Vendor unchanged');

const claimSheetForVendorRecovery = spreadsheet.getSheetByName('Damage Goods Report');
const vendorRecoveryRows = claimSheetForVendorRecovery.rows.map((row, index) => row[21] && String(row[21]).startsWith('SRC-VENDOR-') ? index + 1 : 0).filter(Boolean);
const originalVendorSetCell = claimSheetForVendorRecovery.setCell.bind(claimSheetForVendorRecovery);
let failSecondVendorWriteOnce = true;
claimSheetForVendorRecovery.setCell = (row, column, value) => {
  if (failSecondVendorWriteOnce && row === vendorRecoveryRows[1] && column === 10) {
    failSecondVendorWriteOnce = false;
    throw new Error('injected second Vendor source write failure');
  }
  return originalVendorSetCell(row, column, value);
};
const partialVendorPayload = { action:'assignStockVendor', sku:'SKU-5', unit:'ลัง', vendor:'Vendor E', mutationId:'MUT-VENDOR-PARTIAL' };
const ambiguousVendorAssignment = post(partialVendorPayload);
claimSheetForVendorRecovery.setCell = originalVendorSetCell;
assert.strictEqual(ambiguousVendorAssignment.reason, 'maybe_committed', 'partial Vendor writes must keep the mutation retryable instead of reporting a definitive failure');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-VENDOR-PARTIAL')[3], 'Prepared', 'ambiguous Vendor assignment must keep its ledger Prepared');
const competingVendorAssignment = post({ action:'assignStockVendor', sku:'SKU-5', unit:'ลัง', vendor:'Vendor F', mutationId:'MUT-VENDOR-COMPETING' });
assert.strictEqual(competingVendorAssignment.status, 'error', 'a different mutation must not interleave with an ambiguous Vendor assignment for the same stock group');
const recoveredVendorAssignment = postRaw({ token:'RENAMED_VALID_TOKEN', ...partialVendorPayload, mutationId:'MUT-VENDOR-LOST-ID-RECOVERY' });
assert.strictEqual(recoveredVendorAssignment.status, 'success', recoveredVendorAssignment.message);
assert.ok(vendorRecoveryRows.every(rowNumber => claimSheetForVendorRecovery.rows[rowNumber - 1][9] === 'Vendor E'), 'same-request recovery with a new mutation ID must finish every matching Vendor source row');
assert.strictEqual(spreadsheet.getSheetByName('ProductName').rows[5][5], 'Vendor E', 'lost-ID recovery must reconcile ProductName');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-VENDOR-PARTIAL')[3], 'Committed', 'lost-ID recovery must reconcile the original Prepared ledger');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-VENDOR-LOST-ID-RECOVERY')[3], 'Committed', 'lost-ID recovery must commit its replacement mutation ID');

const legacyVendorSourceRow = vendorRecoveryRows[0];
let failLegacySourceWriteOnce = true;
claimSheetForVendorRecovery.setCell = (row, column, value) => {
  if (failLegacySourceWriteOnce && row === legacyVendorSourceRow && column === 10) {
    failLegacySourceWriteOnce = false;
    throw new Error('injected legacy Vendor source write failure');
  }
  return originalVendorSetCell(row, column, value);
};
const failedLegacyVendor = post({ action:'updateVendor', claimId:'SRC-VENDOR-1', sku:'SKU-5', vendor:'Vendor F' });
claimSheetForVendorRecovery.setCell = originalVendorSetCell;
assert.strictEqual(failedLegacyVendor.status, 'error', 'legacy Vendor write failure must remain visible');
assert.strictEqual(spreadsheet.getSheetByName('ProductName').rows[5][5], 'Vendor E', 'legacy Vendor failure must restore ProductName');
assert.strictEqual(claimSheetForVendorRecovery.rows[legacyVendorSourceRow - 1][9], 'Vendor E', 'legacy Vendor failure must restore the source row');

const productSheetForLegacyAmbiguity = spreadsheet.getSheetByName('ProductName');
const originalProductVendorSetCell = productSheetForLegacyAmbiguity.setCell.bind(productSheetForLegacyAmbiguity);
let productVendorWriteCount = 0;
productSheetForLegacyAmbiguity.setCell = (row, column, value) => {
  if (row === 6 && column === 6) {
    productVendorWriteCount += 1;
    if (productVendorWriteCount === 2) throw new Error('injected legacy ProductName rollback failure');
  }
  return originalProductVendorSetCell(row, column, value);
};
claimSheetForVendorRecovery.setCell = (row, column, value) => {
  if (row === legacyVendorSourceRow && column === 10) throw new Error('injected legacy Vendor source write failure before rollback failure');
  return originalVendorSetCell(row, column, value);
};
const ambiguousLegacyVendor = post({ action:'updateVendor', claimId:'SRC-VENDOR-1', sku:'SKU-5', vendor:'Vendor G' });
productSheetForLegacyAmbiguity.setCell = originalProductVendorSetCell;
claimSheetForVendorRecovery.setCell = originalVendorSetCell;
assert.strictEqual(ambiguousLegacyVendor.reason, 'maybe_committed', 'legacy Vendor rollback failure must report an ambiguous result instead of a definitive failure');
originalProductVendorSetCell(6, 6, 'Vendor E');

const lostPendingCreateRequest = context.mutationRequestJson_('createClaimBill', { vendor: 'Vendor B', items: [{ sku: 'SKU-2', unit: 'ลัง', qty: 1 }], recoveryActor: 'verified-id' });
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-LOST-CREATE-PENDING', 'createClaimBill', 'CLB-LOST-PENDING', 'Prepared', lostPendingCreateRequest, '', '2026-08-16 08:59:00', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimBill').rows.push(['CLB-LOST-PENDING', 'Vendor B', 'Pending', '2026-08-15', 'Verified User', 'MUT-LOST-CREATE-PENDING', '', '', '', '', '', '', '', '', '', '', '', '2026-08-15', 'Verified User']);
spreadsheet.getSheetByName('ClaimBillLine').rows.push(['LINE-LOST-PENDING', 'CLB-LOST-PENDING', 'SRC-NO-VENDOR', 'SKU-2', 'สินค้าไม่มี Vendor', 1, 'ลัง', 'ชำรุด', '', '', 'Generation:MUT-LOST-CREATE-PENDING', '2026-08-15', 'Verified User', '', '']);
const recoveredLostPendingCreate = post({ action:'createClaimBill', vendor:'Vendor B', items:[{ sku:'SKU-2', unit:'ลัง', qty:1 }], mutationId:'MUT-NEW-AFTER-LOST-CREATE-PENDING' });
assert.strictEqual(recoveredLostPendingCreate.status, 'success', recoveredLostPendingCreate.message);
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-LOST-CREATE-PENDING')[3], 'Failed', 'lost prepared create before business commit must be reconciled');
assert.ok(!billRows().some(row => row[0] === 'CLB-LOST-PENDING'), 'inert pending bill from a lost create must be removed');

const lostCommittedCreateRequest = context.mutationRequestJson_('createClaimBill', { vendor: 'Vendor B', items: [{ sku: 'SKU-2', unit: 'ลัง', qty: 1 }], recoveryActor: 'verified-id' });
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-LOST-CREATE-COMMITTED', 'createClaimBill', 'CLB-LOST-COMMITTED', 'Prepared', lostCommittedCreateRequest, '', '2026-08-16 08:59:00', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimBill').rows.push(['CLB-LOST-COMMITTED', 'Vendor B', 'พร้อมส่งเคลม', '2026-08-15', 'Verified User', 'MUT-LOST-CREATE-COMMITTED', 'MUT-LOST-CREATE-COMMITTED', '', '', '', '', '', '', '', '', '', '', '2026-08-15', 'Verified User']);
spreadsheet.getSheetByName('ClaimBillLine').rows.push(['LINE-LOST-COMMITTED', 'CLB-LOST-COMMITTED', 'SRC-NO-VENDOR', 'SKU-2', 'สินค้าไม่มี Vendor', 1, 'ลัง', 'ชำรุด', '', '', 'Generation:MUT-LOST-CREATE-COMMITTED', '2026-08-15', 'Verified User', '', '']);
const adoptedLostCommittedCreate = postRaw({ token:'RENAMED_VALID_TOKEN', action:'createClaimBill', vendor:'Vendor B', items:[{ sku:'SKU-2', unit:'ลัง', qty:1 }], mutationId:'MUT-NEW-AFTER-LOST-CREATE-COMMITTED' });
assert.strictEqual(adoptedLostCommittedCreate.status, 'success', adoptedLostCommittedCreate.message);
assert.strictEqual(adoptedLostCommittedCreate.data.billId, 'CLB-LOST-COMMITTED', 'a lost create committed in business sheets must be adopted instead of duplicated');
assert.strictEqual(billRows().filter(row => row[1] === 'Vendor B').length, 2, 'lost create recovery must produce exactly one bill per request');
assert.strictEqual(readClaimData().claimStock.find(item => item.sku === 'SKU-2').availableQty, 3, 'lost create recovery must consume each request exactly once');

spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-EXPIRED-CREATE', 'createClaimBill', 'CLB-EXPIRED-CREATE', 'Prepared', lostCommittedCreateRequest, '', '2026-08-15 08:00:00', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimBill').rows.push(['CLB-EXPIRED-CREATE', 'Vendor B', 'พร้อมส่งเคลม', '2026-08-15', 'Verified User', 'MUT-EXPIRED-CREATE', 'MUT-EXPIRED-CREATE', '', '', '', '', '', '', '', '', '', '', '2026-08-15', 'Verified User']);
spreadsheet.getSheetByName('ClaimBillLine').rows.push(['LINE-EXPIRED-CREATE', 'CLB-EXPIRED-CREATE', 'SRC-NO-VENDOR', 'SKU-2', 'สินค้าไม่มี Vendor', 1, 'ลัง', 'ชำรุด', '', '', 'Generation:MUT-EXPIRED-CREATE', '2026-08-15', 'Verified User', '', '']);
const intentionalRepeatedCreate = post({ action:'createClaimBill', vendor:'Vendor B', items:[{ sku:'SKU-2', unit:'ลัง', qty:1 }], mutationId:'MUT-INTENTIONAL-REPEAT' });
assert.strictEqual(intentionalRepeatedCreate.status, 'success', intentionalRepeatedCreate.message);
assert.notStrictEqual(intentionalRepeatedCreate.data.billId, 'CLB-EXPIRED-CREATE', 'an expired prepared ledger must not suppress a later intentional identical bill');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-EXPIRED-CREATE')[3], 'Committed', 'expired business-committed create must still reconcile its ledger');
assert.strictEqual(billRows().filter(row => row[1] === 'Vendor B').length, 4, 'intentional identical requests outside the recovery window must create a new bill');
assert.strictEqual(readClaimData().claimStock.find(item => item.sku === 'SKU-2').availableQty, 1, 'expired recovery and intentional repeat must each consume stock exactly once');

assert.strictEqual(readClaimData().claimBills.length, 6, 'bill reads must preserve independent bill headers');
assert.strictEqual(postRaw({ action: 'createClaimBill', vendor: 'Vendor A', items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 1 }], mutationId: 'NO-AUTH' }).reason, 'no_token', 'protected mutations must reject missing SSO tokens');
assert.strictEqual(postRaw({ token: 'READ_ONLY', action: 'createClaimBill', vendor: 'Vendor A', items: [{ sku: 'SKU-1', unit: 'ลัง', qty: 1 }], mutationId: 'NO-PERM' }).reason, 'permission_denied', 'backend must enforce app-ret permissions');
assert.strictEqual(postRaw({ token: 'EMPTY_PERMS', action: 'initClaimBillSheets' }).reason, 'permission_denied', 'current tokens with an authoritative empty permission map must not receive role fallback');
assert.strictEqual(postRaw({ token: 'ADMIN_EMPTY_PERMS', action: 'initClaimBillSheets' }).reason, 'permission_denied', 'current ADMIN tokens with empty permissions must not bypass the authoritative contract');
assert.strictEqual(postRaw({ token: 'ADMIN_EMPTY_PERMS', action: 'addReturn' }).reason, 'permission_denied', 'authoritative-empty ADMIN tokens must not mutate non-claim Returnitem workflows');
assert.strictEqual(postRaw({ token: 'SUPERVISOR_EMPTY_PERMS', action: 'initClaimBillSheets' }).reason, 'permission_denied', 'current SUPERVISOR tokens with empty app permissions must not bypass the authoritative contract');
assert.strictEqual(postRaw({ token: 'LEGACY_TOKEN', action: 'initClaimBillSheets' }).status, 'success', 'legacy tokens without a permission contract must retain role fallback');
const returnRowsBeforeAtomicClaim = spreadsheet.getSheetByName('Return Record').getLastRow();
const claimRowsBeforeAtomicClaim = spreadsheet.getSheetByName('Damage Goods Report').getLastRow();
const atomicReturnPayload = { action:'addReturnWithClaim', id:'RET-ATOMIC', mutationId:'MUT-RETURN-ATOMIC', dateStr:'16/08/2026', timeStr:'09:00', sku:'SKU-A', name:'สินค้า Atomic', qty:1, unit:'ชิ้น', source:'ภายในคลัง', reason:'ชำรุด', qcCondition:'สินค้าเสียหาย', status:'ส่งเคลมแล้ว', customerName:'-', billStatus:'-', compensation:'-', billNo:'-', billDate:'-', claimQty:1, claimUnit:'ชิ้น' };
assert.strictEqual(postRaw({ token:'SPLIT_ADD_ONLY', ...atomicReturnPayload }).reason, 'permission_denied', 'atomic return-to-claim requires both ADD_RET and QC_RET');
assert.strictEqual(spreadsheet.getSheetByName('Return Record').getLastRow(), returnRowsBeforeAtomicClaim, 'split permission denial must not write Return Record');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').getLastRow(), claimRowsBeforeAtomicClaim, 'split permission denial must not write Damage Goods Report');
assert.strictEqual(post(atomicReturnPayload).status, 'success', 'authorized atomic return-to-claim must write both records');
assert.strictEqual(spreadsheet.getSheetByName('Return Record').getLastRow(), returnRowsBeforeAtomicClaim + 1);
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').getLastRow(), claimRowsBeforeAtomicClaim + 1);
const atomicRetry = post(atomicReturnPayload);
assert.strictEqual(atomicRetry.status, 'success', 'ambiguous retry must reconcile the original return-to-claim request');
assert.strictEqual(atomicRetry.data.idempotent, true, 'retry must report an idempotent result');
assert.strictEqual(spreadsheet.getSheetByName('Return Record').getLastRow(), returnRowsBeforeAtomicClaim + 1, 'retry must not duplicate Return Record');
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').getLastRow(), claimRowsBeforeAtomicClaim + 1, 'retry must not duplicate Damage Goods Report');
const mismatchedAtomicRetry = post({ ...atomicReturnPayload, sku:'SKU-CONFLICT' });
assert.strictEqual(mismatchedAtomicRetry.status, 'error', 'reused return identity with different business data must be rejected');
assert.ok(spreadsheet.getSheetByName('Return Record').rows.some(row => row[0] === 'RET-ATOMIC'), 'rejected mismatch must preserve the original return row');
const derivedReturnRowsBefore = spreadsheet.getSheetByName('Return Record').getLastRow();
const derivedClaimRowsBefore = spreadsheet.getSheetByName('Damage Goods Report').getLastRow();
const derivedAtomicPayload = { ...atomicReturnPayload, id:'', mutationId:'MUT-RETURN-DERIVED', sku:'SKU-DERIVED', name:'สินค้า Derived' };
const derivedAtomicReturn = post(derivedAtomicPayload);
assert.strictEqual(derivedAtomicReturn.status, 'success', 'frontend-style return-to-claim requests must derive stable IDs from the mutation');
assert.strictEqual(derivedAtomicReturn.data.returnId, 'RET-MUT-RETURN-DERIVED');
assert.strictEqual(derivedAtomicReturn.data.claimId, 'CLM-RET-MUT-RETURN-DERIVED');
assert.strictEqual(post(derivedAtomicPayload).data.idempotent, true, 'derived-ID retry must reconcile without duplicate rows');
assert.strictEqual(spreadsheet.getSheetByName('Return Record').getLastRow(), derivedReturnRowsBefore + 1);
assert.strictEqual(spreadsheet.getSheetByName('Damage Goods Report').getLastRow(), derivedClaimRowsBefore + 1);
const claimSheetForFailure = spreadsheet.getSheetByName('Damage Goods Report');
const originalClaimAppendRow = claimSheetForFailure.appendRow.bind(claimSheetForFailure);
claimSheetForFailure.appendRow = () => {
  claimSheetForFailure.rows.push(claimRow({ date:'16/08/2026', sku:'SKU-CONCURRENT', name:'Concurrent Row', qty:1, unit:'ชิ้น', vendor:'Vendor Concurrent', status:'รอเคลม', id:'CONCURRENT-CLAIM' }));
  throw new Error('injected concurrent claim append failure');
};
const failedAtomicReturn = post({ ...atomicReturnPayload, id:'RET-ATOMIC-FAIL', mutationId:'MUT-RETURN-ATOMIC-FAIL' });
claimSheetForFailure.appendRow = originalClaimAppendRow;
assert.strictEqual(failedAtomicReturn.status, 'error', 'injected second-sheet failure must fail the atomic request');
assert.ok(!spreadsheet.getSheetByName('Return Record').rows.some(row => row[0] === 'RET-ATOMIC-FAIL'), 'compensation must remove only the failed request return row');
assert.ok(claimSheetForFailure.rows.some(row => row[21] === 'CONCURRENT-CLAIM'), 'compensation must preserve a concurrently appended unrelated claim row');
const ambiguousReturnPayload = { ...atomicReturnPayload, id:'RET-ATOMIC-AMBIGUOUS', mutationId:'MUT-RETURN-ATOMIC-AMBIGUOUS' };
const originalClearLastRowByValue = context.clearLastRowByValue_;
const compensationCalls = [];
context.clearLastRowByValue_ = (sheet, columnIndex, value) => {
  compensationCalls.push({ sheet:sheet.getName(), columnIndex, value });
  if (sheet.getName() === 'Return Record') throw new Error('injected return compensation failure');
  return originalClearLastRowByValue(sheet, columnIndex, value);
};
claimSheetForFailure.appendRow = row => {
  originalClaimAppendRow(row);
  throw new Error('injected claim append acknowledgement failure');
};
const ambiguousAtomicReturn = post(ambiguousReturnPayload);
claimSheetForFailure.appendRow = originalClaimAppendRow;
context.clearLastRowByValue_ = originalClearLastRowByValue;
assert.strictEqual(ambiguousAtomicReturn.reason, 'maybe_committed', 'failed compensation must report an ambiguous atomic outcome');
assert.deepStrictEqual(compensationCalls.map(call => call.sheet), ['Return Record', 'Damage Goods Report'], 'both compensations must be attempted even when the first one fails');
assert.ok(spreadsheet.getSheetByName('Return Record').rows.some(row => row[0] === 'RET-ATOMIC-AMBIGUOUS'), 'ambiguous failure may retain the return row');
assert.ok(!claimSheetForFailure.rows.some(row => row[21] === 'CLM-RET-ATOMIC-AMBIGUOUS'), 'the independent claim compensation must still run');
assert.strictEqual(post(ambiguousReturnPayload).status, 'success', 'retrying the retained mutation identity must complete the missing half');
assert.strictEqual(claimSheetForFailure.rows.filter(row => row[21] === 'CLM-RET-ATOMIC-AMBIGUOUS').length, 1, 'ambiguous retry must leave exactly one claim row');
const legacyQcReturnSheet = spreadsheet.getSheetByName('Return Record');
legacyQcReturnSheet.rows.push(['RET-QC-RETRY', '16/08/2026', '09:15', 'SKU-QC', 'สินค้า QC เดิม', 2, 'ชิ้น', 'ภายในคลัง', 'ชำรุด', '', 'รอ QC', '-', '-', '-', '-', '-']);
const legacyQcPayload = { action:'updateReturnQC', id:'RET-QC-RETRY', grade:'C', status:'ส่งเคลมแล้ว', qcCondition:'สินค้าเสียหาย', sku:'SKU-QC', name:'สินค้า QC เดิม', qty:2, unit:'ชิ้น', source:'ภายในคลัง', reason:'ชำรุด' };
assert.strictEqual(post(legacyQcPayload).status, 'success', 'legacy Grade-C QC must create its damaged-goods intake');
assert.strictEqual(post(legacyQcPayload).status, 'success', 'retrying the same legacy Grade-C QC request must reconcile idempotently');
assert.strictEqual(claimSheetForFailure.rows.filter(row => row[3] === 'SKU-QC' && row[21] === 'CLM-RET-QC-RETRY').length, 1, 'legacy Grade-C QC retries must create exactly one deterministic claim source');
const productVendorBeforeMismatch = spreadsheet.getSheetByName('ProductName').rows[1][5];
const concurrentClaimRow = claimSheetForFailure.rows.find(row => row[21] === 'CONCURRENT-CLAIM');
const sourceVendorBeforeMismatch = concurrentClaimRow[9];
const mismatchedSourceVendor = post({ action:'updateVendor', claimId:'CONCURRENT-CLAIM', sku:'SKU-1', vendor:'Vendor Wrong Master' });
assert.strictEqual(mismatchedSourceVendor.status, 'error', 'Vendor update must bind ProductName to the authoritative source SKU');
assert.strictEqual(spreadsheet.getSheetByName('ProductName').rows[1][5], productVendorBeforeMismatch, 'mismatched Vendor update must preserve ProductName');
assert.strictEqual(concurrentClaimRow[9], sourceVendorBeforeMismatch, 'mismatched Vendor update must preserve the source Vendor');
const publicClaimData = readPublicClaimData();
assert.strictEqual(publicClaimData.claimBillAccess, false, 'protected read denial must be explicit');
assert.strictEqual(publicClaimData.claimBillAuthError.reason, 'no_token', 'protected read denial must preserve the auth reason');
assert.deepStrictEqual(JSON.parse(JSON.stringify(publicClaimData.claimBills)), [], 'unauthenticated reads must not expose claim bill headers');
assert.deepStrictEqual(JSON.parse(JSON.stringify(publicClaimData.claimBillLines)), [], 'unauthenticated reads must not expose claim allocations');
assert.deepStrictEqual(JSON.parse(JSON.stringify(publicClaimData.claimStock)), [], 'unauthenticated reads must not expose damaged-stock balances');
const warehouseOnlyClaimData = JSON.parse(context.doGet({ parameter: { includeProducts: '0', token: 'WH_ONLY' } }).getContent()).data;
assert.strictEqual(warehouseOnlyClaimData.claimBillAccess, false, 'WH_CLM alone must not grant damaged-stock or bill-ledger reads');
assert.strictEqual(warehouseOnlyClaimData.claimBillAuthError.reason, 'permission_denied', 'WH-only bill read denial must be explicit');
assert.deepStrictEqual(JSON.parse(JSON.stringify(warehouseOnlyClaimData.claimBills)), [], 'WH-only reads must not expose bill headers');
assert.deepStrictEqual(JSON.parse(JSON.stringify(warehouseOnlyClaimData.claimBillLines)), [], 'WH-only reads must not expose allocation lines');
assert.deepStrictEqual(JSON.parse(JSON.stringify(warehouseOnlyClaimData.claimStock)), [], 'WH-only reads must not expose damaged-stock balances');
const warehouseOnlyHistory = JSON.parse(context.doGet({ parameter: { action: 'getClaimBillHistory', token: 'WH_ONLY' } }).getContent());
assert.strictEqual(warehouseOnlyHistory.reason, 'permission_denied', 'WH_CLM alone must not grant closed bill history');
const trackingOnlyClaimData = JSON.parse(context.doGet({ parameter: { includeProducts: '0', token: 'TRACK_ONLY' } }).getContent()).data;
assert.strictEqual(trackingOnlyClaimData.claimBillAccess, true, 'TRACK_CLM must retain bill tracking reads');
assert.ok(trackingOnlyClaimData.claimBills.length > 0, 'TRACK_CLM must receive bill headers');
assert.deepStrictEqual(JSON.parse(JSON.stringify(trackingOnlyClaimData.claimStock)), [], 'TRACK_CLM alone must not receive damaged-stock balances');

assert.throws(() => context.getHeaderMap_(new MemorySheet('BadHeaders', [billHeaders.slice().reverse()]), billHeaders), /ลำดับ Header/, 'reordered headers must be rejected');

const originalCommitMutation = context.commitMutation_;
let failLedgerCommitOnce = true;
context.commitMutation_ = (...args) => {
  if (failLedgerCommitOnce) {
    failLedgerCommitOnce = false;
    throw new Error('injected ledger commit failure');
  }
  return originalCommitMutation(...args);
};
const commitRecovered = post({ action: 'createClaimBill', vendor: 'Vendor D', items: [{ sku: 'SKU-4', unit: 'ลัง', qty: 2 }], mutationId: 'MUT-COMMIT-RECOVERY' });
context.commitMutation_ = originalCommitMutation;
assert.strictEqual(commitRecovered.status, 'success', commitRecovered.message);
assert.strictEqual(billRows().filter(row => row[5] === 'MUT-COMMIT-RECOVERY').length, 1, 'ledger commit retry must not duplicate a ready bill');
assert.strictEqual(readClaimData().claimStock.find(item => item.sku === 'SKU-4').availableQty, 2, 'reconciled commit must retain exactly one allocation');

const recoveryBillId = 'CLB-RECOVERY';
const recoveryRequest = context.mutationRequestJson_('createClaimBill', { vendor: 'Vendor C', items: [{ sku: 'SKU-3', unit: 'ลัง', qty: 5 }], recoveryActor: 'verified-id' });
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-RECOVERY', 'createClaimBill', recoveryBillId, 'Prepared', recoveryRequest, '', '2026-08-15', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimBill').rows.push([recoveryBillId, 'Vendor C', 'Pending', '2026-08-15', 'Verified User', 'MUT-RECOVERY', '', '', '', '', '', '', '', '', '', '', '', '2026-08-15', 'Verified User']);
spreadsheet.getSheetByName('ClaimBillLine').rows.push(['PARTIAL-LINE', recoveryBillId, 'SRC-RECOVERY', 'SKU-3', 'สินค้าทดสอบ Recovery', 3, 'ลัง', 'ชำรุด', '', '', 'Generation:MUT-RECOVERY', '2026-08-15', 'Verified User', '', '']);
const recoveredCreate = post({ action: 'createClaimBill', vendor: 'Vendor C', items: [{ sku: 'SKU-3', unit: 'ลัง', qty: 5 }], mutationId: 'MUT-RECOVERY' });
assert.strictEqual(recoveredCreate.status, 'success', recoveredCreate.message);
assert.strictEqual(activeLineRows().filter(row => row[1] === recoveryBillId).reduce((sum, row) => sum + row[5], 0), 5, 'retry must replace partial staged create lines before commit');

const editRequest = context.mutationRequestJson_('updateClaimBillItems', { billId: recoveryBillId, items: [{ sku: 'SKU-3', unit: 'ลัง', qty: 2 }] });
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-RECOVERY-EDIT', 'updateClaimBillItems', recoveryBillId, 'Prepared', editRequest, '', '2026-08-15', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimBillLine').rows.push(['PARTIAL-EDIT', recoveryBillId, 'SRC-RECOVERY', 'SKU-3', 'สินค้าทดสอบ Recovery', 1, 'ลัง', 'ชำรุด', '', '', 'Generation:MUT-RECOVERY-EDIT', '2026-08-15', 'Verified User', '', '']);
const recoveredEdit = post({ action: 'updateClaimBillItems', billId: recoveryBillId, items: [{ sku: 'SKU-3', unit: 'ลัง', qty: 2 }], mutationId: 'MUT-RECOVERY-EDIT' });
assert.strictEqual(recoveredEdit.status, 'success', recoveredEdit.message);
assert.strictEqual(readClaimData().claimStock.find(item => item.sku === 'SKU-3').availableQty, 6, 'retry must commit only the recovered edit generation');

const lostEditRequest = context.mutationRequestJson_('updateClaimBillItems', { billId: recoveryBillId, items: [{ sku: 'SKU-3', unit: 'ลัง', qty: 4 }] });
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-LOST-EDIT', 'updateClaimBillItems', recoveryBillId, 'Prepared', lostEditRequest, '', '2026-08-15', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimBillLine').rows.push(['LOST-EDIT-LINE', recoveryBillId, 'SRC-RECOVERY', 'SKU-3', 'สินค้าทดสอบ Recovery', 1, 'ลัง', 'ชำรุด', '', '', 'Generation:MUT-LOST-EDIT', '2026-08-15', 'Verified User', '', '']);
const recoveredWithoutClientId = post({ action: 'updateClaimBillItems', billId: recoveryBillId, items: [{ sku: 'SKU-3', unit: 'ลัง', qty: 3 }], mutationId: 'MUT-NEW-AFTER-LOST' });
assert.strictEqual(recoveredWithoutClientId.status, 'success', recoveredWithoutClientId.message);
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-LOST-EDIT')[3], 'Failed', 'a stranded prepared edit must be reconciled when the original client ID is lost');
assert.strictEqual(readClaimData().claimStock.find(item => item.sku === 'SKU-3').availableQty, 5, 'a new mutation must proceed after stranded recovery without consuming inert lines');

const notifyRecovery = post({ action: 'updateClaimBillStatus', billId: recoveryBillId, status: 'แจ้งเคลมแล้ว', mutationId: 'MUT-RECOVERY-NOTIFY' });
assert.strictEqual(notifyRecovery.status, 'success', notifyRecovery.message);
assert.strictEqual(post({ action: 'updateClaimBillStatus', billId: recoveryBillId, status: 'ปิดงานแล้ว', claimType: 'ผลลัพธ์ที่ระบบไม่รองรับ', mutationId: 'MUT-INVALID-RESOLUTION' }).status, 'error', 'claim resolution type must be allowlisted');
assert.strictEqual(post({ action: 'updateClaimBillStatus', billId: recoveryBillId, status: 'ปิดงานแล้ว', claimType: 'คืนสินค้าหักใบบิล', claimBillNo: 'INV-001', mutationId: 'MUT-MISSING-AMOUNT' }).status, 'error', 'bill-deduction resolution must require a positive amount');
const resolvedRecovery = post({ action: 'updateClaimBillStatus', billId: recoveryBillId, status: 'ปิดงานแล้ว', claimType: 'คืนสินค้าหักใบบิล', claimBillNo: 'INV-001', claimAmount: '120.50', mutationId: 'MUT-VALID-RESOLUTION' });
assert.strictEqual(resolvedRecovery.status, 'success', resolvedRecovery.message);
const resolvedRecoveryRow = billRows().find(row => row[0] === recoveryBillId);
assert.strictEqual(resolvedRecoveryRow[9], 'คืนสินค้าหักใบบิล');
assert.strictEqual(resolvedRecoveryRow[10], 'INV-001');
assert.strictEqual(resolvedRecoveryRow[11], '120.50');
const matchingPreparedStatusRequest = context.mutationRequestJson_('updateClaimBillStatus', { billId:recoveryBillId, status:'ปิดงานแล้ว', claimType:'คืนสินค้าหักใบบิล', claimBillNo:'INV-001', claimAmount:'120.50' });
const conflictingPreparedStatusRequest = context.mutationRequestJson_('updateClaimBillStatus', { billId:recoveryBillId, status:'ปิดงานแล้ว', claimType:'คืนสินค้า-ทำCN', claimBillNo:'-', claimAmount:'-' });
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-PREPARED-STATUS-MATCH', 'updateClaimBillStatus', recoveryBillId, 'Prepared', matchingPreparedStatusRequest, '', '2026-08-15', 'Verified User', '']);
spreadsheet.getSheetByName('ClaimMutation').rows.push(['MUT-PREPARED-STATUS-CONFLICT', 'updateClaimBillStatus', recoveryBillId, 'Prepared', conflictingPreparedStatusRequest, '', '2026-08-15', 'Verified User', '']);
const reconciledSameStatus = post({ action:'updateClaimBillStatus', billId:recoveryBillId, status:'ปิดงานแล้ว', claimType:'คืนสินค้าหักใบบิล', claimBillNo:'INV-001', claimAmount:'120.50', mutationId:'MUT-RECONCILE-STATUS-TRIGGER' });
assert.strictEqual(reconciledSameStatus.status, 'success', reconciledSameStatus.message);
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-PREPARED-STATUS-MATCH')[3], 'Committed', 'a prepared status mutation must reconcile only when every supplied result field matches persisted data');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-PREPARED-STATUS-CONFLICT')[3], 'Failed', 'a prepared status mutation with a conflicting persisted resolution must not reconcile as committed');
const conflictingSameStatus = post({ action:'updateClaimBillStatus', billId:recoveryBillId, status:'ปิดงานแล้ว', claimType:'คืนสินค้า-ทำCN', claimBillNo:'-', claimAmount:'-', mutationId:'MUT-CONFLICTING-SAME-STATUS' });
assert.strictEqual(conflictingSameStatus.status, 'error', 'a new same-status mutation must not succeed when its resolution differs from the persisted bill');
assert.strictEqual(resolvedRecoveryRow[9], 'คืนสินค้าหักใบบิล', 'rejected same-status mutation must preserve the persisted resolution');
assert.strictEqual(spreadsheet.getSheetByName('ClaimMutation').rows.find(row => row[0] === 'MUT-CONFLICTING-SAME-STATUS')[3], 'Failed', 'rejected same-status mutation must not be recorded as committed');

for (let i = 0; i < 101; i += 1) {
  const billId = `CLB-HISTORY-${String(i).padStart(3, '0')}`;
  spreadsheet.getSheetByName('ClaimBill').rows.push([billId, 'Vendor History', 'ปิดงานแล้ว', `2026-07-${String(i).padStart(3, '0')}`, 'Verified User', `MUT-H-${i}`, `MUT-H-${i}`, '', '', 'คืนสินค้า-ทำCN', '-', '-', `2026-07-${String(i).padStart(3, '0')}`, 'Verified User', '', '', '', `2026-07-${String(i).padStart(3, '0')}`, 'Verified User']);
  spreadsheet.getSheetByName('ClaimBillLine').rows.push([`LINE-H-${i}`, billId, `SRC-H-${i}`, 'SKU-H', 'สินค้าประวัติ', 1, 'ชิ้น', 'ชำรุด', '', i === 100 ? new Date('2026-08-15T00:00:00Z') : '', `Generation:MUT-H-${i}`, '2026-07-01', 'Verified User', '', '']);
}
const productSheetForReads = spreadsheet.getSheetByName('ProductName');
const damageSheetForReads = spreadsheet.getSheetByName('Damage Goods Report');
const billSheetForReads = spreadsheet.getSheetByName('ClaimBill');
const lineSheetForReads = spreadsheet.getSheetByName('ClaimBillLine');
[productSheetForReads, damageSheetForReads, billSheetForReads, lineSheetForReads].forEach(sheet => { sheet.readLog = []; });
const firstHistoryPage = readClaimHistory({ offset: '0', limit: '100' });
assert.strictEqual(firstHistoryPage.status, 'success');
assert.strictEqual(firstHistoryPage.data.claimBills.length, 100, 'history endpoint must return a bounded page');
assert.strictEqual(firstHistoryPage.data.hasMore, true, 'history endpoint must advertise older bills');
assert.strictEqual(firstHistoryPage.data.claimBillLines.find(line => line.lineId === 'LINE-H-100').expDate, '15/08/2026', 'expiry dates must use the application display format');
assert.strictEqual(productSheetForReads.readLog.length, 0, 'history reads must not load ProductName');
assert.strictEqual(damageSheetForReads.readLog.length, 0, 'history reads must not load Damage Goods Report');
assert.ok(!billSheetForReads.readLog.some(read => read.row === 2 && read.numRows === billSheetForReads.getLastRow() - 1 && read.numColumns === billSheetForReads.getLastColumn()), 'history reads must not hydrate every bill row at full width');
assert.ok(!lineSheetForReads.readLog.some(read => read.row === 2 && read.numRows === lineSheetForReads.getLastRow() - 1 && read.numColumns === lineSheetForReads.getLastColumn()), 'history reads must not hydrate every line row at full width');
[productSheetForReads, damageSheetForReads, billSheetForReads, lineSheetForReads].forEach(sheet => { sheet.readLog = []; });
const boundedPrint = readClaimBillForPrint('CLB-HISTORY-100');
assert.strictEqual(boundedPrint.status, 'success', boundedPrint.message);
assert.strictEqual(productSheetForReads.readLog.length, 0, 'print reads must not load ProductName');
assert.strictEqual(damageSheetForReads.readLog.length, 0, 'print reads must not load Damage Goods Report');
assert.ok(!billSheetForReads.readLog.some(read => read.row === 2 && read.numRows === billSheetForReads.getLastRow() - 1 && read.numColumns === billSheetForReads.getLastColumn()), 'print reads must hydrate only the requested bill');
assert.ok(!lineSheetForReads.readLog.some(read => read.row === 2 && read.numRows === lineSheetForReads.getLastRow() - 1 && read.numColumns === lineSheetForReads.getLastColumn()), 'print reads must hydrate only matching bill lines');
[billSheetForReads, lineSheetForReads].forEach(sheet => { sheet.readLog = []; });
const boundedInitialData = readClaimData();
assert.strictEqual(boundedInitialData.claimBillAccess, true);
assert.ok(!billSheetForReads.readLog.some(read => read.row === 2 && read.numRows === billSheetForReads.getLastRow() - 1 && read.numColumns === billSheetForReads.getLastColumn()), 'initial reads must use a narrow allocation index instead of hydrating every bill row');
assert.ok(!lineSheetForReads.readLog.some(read => read.row === 2 && read.numRows === lineSheetForReads.getLastRow() - 1 && read.numColumns === lineSheetForReads.getLastColumn()), 'initial reads must use a narrow allocation index instead of hydrating every line row');
const secondHistoryPage = readClaimHistory({ offset: '100', limit: '100' });
assert.ok(secondHistoryPage.data.claimBills.length >= 3, 'closed bills beyond the initial 100 must remain retrievable');
assert.ok(secondHistoryPage.data.claimBillLines.length >= secondHistoryPage.data.claimBills.length, 'history pages must include committed lines for reprint');
const deniedHistory = JSON.parse(context.doGet({ parameter: { action: 'getClaimBillHistory', offset: '100' } }).getContent());
assert.strictEqual(deniedHistory.reason, 'no_token', 'history pagination must require authenticated claim access');
console.log('claim stock/bill contract passed');
