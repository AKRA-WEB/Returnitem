// ==========================================
// ⚙️ ตั้งค่าระบบ (Configuration)
// ==========================================
// ⚠️ ใส่ ID ของ Google Sheet ของคุณที่นี่
const TARGET_SHEET_ID = '1cP25dNFYJHFB4MUvDUSVrV_yGrzYLsC4y7oKgV0-ohE'; 

// ==========================================
// 📥 ฝั่งดึงข้อมูล (GET) - โหลดข้อมูลเข้าแอป
// ==========================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(TARGET_SHEET_ID);
    const response = { status: 'success', data: {} };
    
    // ฟังก์ชันช่วยหาแท็บแบบปลอดภัยสำหรับฝั่ง GET (ถ้าหาไม่เจอให้ข้ามไป ไม่ให้พัง)
    function getSheetForRead(sheetName) {
       let sheet = ss.getSheetByName(sheetName) || ss.getSheetByName(sheetName + ' ');
       if (!sheet) {
          sheet = ss.getSheets().find(s => s.getName().trim().toLowerCase() === sheetName.toLowerCase());
       }
       return sheet;
    }

    // ฟังก์ชันป้องกันระบบล่ม หากวันที่ใน Google Sheet ถูกจัดรูปแบบเป็นตัวอักษรธรรมดา
    function safeFormatDate(val) {
       if (!val) return '';
       if (val instanceof Date) return Utilities.formatDate(val, "Asia/Bangkok", "dd/MM/yyyy");
       return String(val); // คืนค่าตัวอักษรกลับไปทันทีถ้าไม่ใช่วันที่
    }

    // 1. ดึงข้อมูลสินค้า (ProductName)
    const productSheet = getSheetForRead('ProductName');
    response.data.products = productSheet ? productSheet.getDataRange().getValues().slice(1).map(r => ({
      sku: String(r[0] || ''), 
      name: String(r[1] || ''), 
      unit: String(r[3] || 'ชิ้น'), 
      vendor: String(r[5] || 'ไม่ระบุ Vendor')
    })) : [];

    // 2. ดึงข้อมูล Claims (Damage Goods Report)
    const claimSheet = getSheetForRead('Damage Goods Report');
    let claims = [];
    if (claimSheet) {
      const cData = claimSheet.getDataRange().getValues();
      for (let i = 1; i < cData.length; i++) {
        if (cData[i][0]) {
          claims.push({
            reportDate: safeFormatDate(cData[i][0]),
            whReceiver: String(cData[i][1] || ''),
            whLocation: String(cData[i][2] || ''),
            sku: String(cData[i][3] || ''),
            name: String(cData[i][4] || ''),
            qty: cData[i][5] || 0,
            unit: String(cData[i][6] || ''),
            whStatus: String(cData[i][8] || ''),
            vendor: String(cData[i][9] || ''),
            status: String(cData[i][10] || ''),
            returnDate: safeFormatDate(cData[i][11]),
            reason: String(cData[i][15] || ''),
            remark: String(cData[i][16] || ''),
            claimType: String(cData[i][17] || ''),
            claimBillNo: String(cData[i][18] || ''),
            claimAmount: String(cData[i][19] || ''),
            foundLocation: String(cData[i][20] || ''),
            id: String(cData[i][21] || ''),
            expDate: safeFormatDate(cData[i][22])
          });
        }
      }
    }
    response.data.claims = claims;

    // 3. ดึงข้อมูล Returns (Return Record)
    const returnSheet = getSheetForRead('Return Record');
    let returns = [];
    if (returnSheet) {
      const rData = returnSheet.getDataRange().getValues();
      for (let i = 1; i < rData.length; i++) {
        if (rData[i][0]) {
          returns.push({
            id: String(rData[i][0] || ''),
            dateStr: safeFormatDate(rData[i][1]),
            timeStr: (rData[i][2] instanceof Date) ? Utilities.formatDate(rData[i][2], "Asia/Bangkok", "HH:mm") : String(rData[i][2] || ''),
            sku: String(rData[i][3] || ''),
            name: String(rData[i][4] || ''),
            qty: rData[i][5] || 0,
            unit: String(rData[i][6] || ''),
            source: String(rData[i][7] || ''),
            reason: String(rData[i][8] || ''),
            qcCondition: String(rData[i][9] || ''),
            status: String(rData[i][10] || ''),
            customerName: String(rData[i][11] || ''),
            billStatus: String(rData[i][12] || ''),
            compensation: String(rData[i][13] || ''),
            billNo: String(rData[i][14] || '')
          });
        }
      }
    }
    response.data.returns = returns;

    // 4. ดึงข้อมูล Audit (AuditTask)
    const auditSheet = getSheetForRead('AuditTask');
    let audits = [];
    if (auditSheet) {
      const aData = auditSheet.getDataRange().getValues();
      for(let i=1; i<aData.length; i++){
         if(aData[i][0]){
            audits.push({
               taskId: String(aData[i][0] || ''),
               createdDate: String(aData[i][1] || ''),
               createdBy: String(aData[i][2] || ''),
               targetWH: String(aData[i][3] || ''),
               id: String(aData[i][4] || ''),
               sku: String(aData[i][5] || ''),
               name: String(aData[i][6] || ''),
               unit: String(aData[i][7] || ''),
               trdStatus: String(aData[i][8] || ''),
               trdCountQty: String(aData[i][9] || ''),
               trdCountBy: String(aData[i][10] || ''),
               akraStatus: String(aData[i][11] || ''),
               akraCountQty: String(aData[i][12] || ''),
               akraCountBy: String(aData[i][13] || ''),
               sysStock: String(aData[i][14] || ''),
               stockDiff: String(aData[i][15] || ''),
               overallStatus: String(aData[i][16] || '')
            });
         }
      }
    }
    response.data.audits = audits;

    const cb = e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(`${cb}(${JSON.stringify(response)})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 📤 ฝั่งบันทึกข้อมูล (POST) - จากแอปส่งไป Sheet
// ==========================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.openById(TARGET_SHEET_ID);

    function createSuccessResponse() {
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ฟังก์ชันเสริมสำหรับหาแท็บแบบยืดหยุ่น ป้องกัน Error Null สำหรับฝั่ง POST ---
    function getSheetSafe(sheetName) {
       let sheet = ss.getSheetByName(sheetName) || ss.getSheetByName(sheetName + ' ');
       if (!sheet) {
          // ค้นหาแบบไม่สนตัวพิมพ์เล็กใหญ่ และตัดช่องว่างทิ้ง
          sheet = ss.getSheets().find(s => s.getName().trim().toLowerCase() === sheetName.toLowerCase());
       }
       if (!sheet) throw new Error(`ไม่พบแท็บชื่อ "${sheetName}" ใน Google Sheet กรุณาสร้างแท็บนี้ก่อนทำรายการ!`);
       return sheet;
    }

    if (action === 'addReturn') {
      const sheet = getSheetSafe('Return Record');
      sheet.appendRow([
        data.id, data.dateStr, data.timeStr, data.sku, data.name, data.qty, data.unit, data.source, data.reason, data.qcCondition, data.status, data.customerName, data.billStatus, data.compensation, data.billNo
      ]);
      return createSuccessResponse();
    }

    if (action === 'addDrafts') {
      const claimSheet = getSheetSafe('Damage Goods Report');
      data.drafts.forEach(d => {
        claimSheet.appendRow([
          d.reportDate, '', '', d.sku, d.name, d.qty, d.unit, '', 'ยังไม่รับ', d.vendor, 'รอคลังรับของ', '', '', '', '', d.reason, d.remark, '', '', '', d.foundLocation, d.id, d.expDate, d.reporter
        ]);
      });
      return createSuccessResponse();
    }

    if (action === 'updateReturnQC') {
      const sheet = getSheetSafe('Return Record');
      const rowNum = findRowByUID(sheet, data.id, 0); // ID in col A
      if (rowNum > -1) {
        sheet.getRange(rowNum, 10).setValue(data.qcCondition); // Col J
        sheet.getRange(rowNum, 11).setValue(data.status); // Col K
      }
      if (data.grade === 'C') {
         const claimSheet = getSheetSafe('Damage Goods Report');
         const d = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy");
         const newId = 'CLM-RET-' + Date.now();
         // ส่งเข้าคลังเคลม โดยตั้งค่าสถานะให้ไปรอคลังกดยืนยันรับเข้า
         claimSheet.appendRow([
            d, '', '', data.sku, data.name, data.qty, data.unit, '', 'ยังไม่รับ', 'รอระบุ Vendor', 'รอคลังรับของ', '', '', '', '', data.reason, 'จากงานรับคืน', '', '', '', 'ภายในคลัง', newId, '', data.user
         ]);
      }
      return createSuccessResponse();
    }

    if (action === 'updateReturnBatch') {
      const sheet = getSheetSafe('Return Record');
      data.ids.forEach(id => {
         const rowNum = findRowByUID(sheet, id, 0);
         if (rowNum > -1) sheet.getRange(rowNum, 11).setValue('ตัดรอบแล้ว');
      });
      return createSuccessResponse();
    }

    if (action === 'confirmWHReceive') {
      const sheet = getSheetSafe('Damage Goods Report');
      const rowNum = findRowByUID(sheet, data.id, 21); // ID in Col V (idx 21)
      if (rowNum > -1) {
         sheet.getRange(rowNum, 9).setValue('รับเข้าแล้ว'); // Col I
         sheet.getRange(rowNum, 11).setValue('รอเคลม'); // Col K
         sheet.getRange(rowNum, 2).setValue(data.whReceiver || ''); // Col B
         sheet.getRange(rowNum, 3).setValue(data.whLocation || ''); // Col C
      }
      return createSuccessResponse();
    }

    if (action === 'bulkUpdateStatus') {
      const sheet = getSheetSafe('Damage Goods Report');
      data.ids.forEach(id => {
        const rowNum = findRowByUID(sheet, id, 21);
        if (rowNum > -1) {
          sheet.getRange(rowNum, 11).setValue(data.status);
          if (data.status === 'สำเร็จแล้ว' || data.status === 'เคลมแล้ว') {
            const now = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy");
            sheet.getRange(rowNum, 12).setValue(now); // Return Date Col L
          }
          if (data.isFinancial) {
            sheet.getRange(rowNum, 18).setValue(data.claimType || '');
            sheet.getRange(rowNum, 19).setValue(data.claimBillNo || '');
            sheet.getRange(rowNum, 20).setValue(data.claimAmount || '');
          }
        }
      });
      return createSuccessResponse();
    }

    if (action === 'deleteClaim') {
      const sheet = getSheetSafe('Damage Goods Report');
      const rowNum = findRowByUID(sheet, data.id, 21);
      if(rowNum > -1) {
         sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).clearContent(); 
      }
      return createSuccessResponse();
    }

    if (action === 'updateVendor') {
      // 1. อัปเดตใน Master สินค้า (ProductName)
      const prodSheet = getSheetSafe('ProductName');
      if (prodSheet) {
        const pData = prodSheet.getDataRange().getValues();
        for (let i = 1; i < pData.length; i++) {
          if (String(pData[i][0]) === String(data.sku)) {
            const cell = prodSheet.getRange(i + 1, 6);
            cell.clearDataValidations(); // ปลดล็อค Data Validation ก่อน
            cell.setValue(data.vendor); // เขียนข้อมูลลงคอลัมน์ F (Vendor)
            break;
          }
        }
      }

      // 2. อัปเดตใน Damage Goods Report
      const claimSheet = getSheetSafe('Damage Goods Report');
      if (claimSheet) {
        const headers = claimSheet.getRange(1, 1, 1, claimSheet.getLastColumn()).getValues()[0];
        // ค้นหาว่าคอลัมน์ Vendor อยู่ที่ตำแหน่งไหน
        const vendorCol = headers.findIndex(h => h.toString().toLowerCase().includes('vendor')) + 1;
        
        if (vendorCol > 0) {
          const rowNum = findRowByUID(claimSheet, data.claimId, 21); // ID อยู่คอลัมน์ V (index 21)
          if (rowNum > -1) {
            const claimCell = claimSheet.getRange(rowNum, vendorCol);
            claimCell.clearDataValidations(); // ปลดล็อค Data Validation
            claimCell.setValue(data.vendor);
          }
        }
      }
      return createSuccessResponse();
    }

    // ==========================================
    // 📋 ส่วนของระบบนับสต๊อก (Inventory Audit)
    // ==========================================
    if (action === 'createAudit') {
      const sheet = getSheetSafe('AuditTask'); // เช็คความถูกต้องของชื่อแท็บก่อนเสมอ
      data.items.forEach((item, idx) => {
         const rowId = data.taskId + '-' + idx;
         sheet.appendRow([
            data.taskId, data.dateStr, data.user, data.targetWH, rowId, item.sku, item.name, item.unit,
            'Pending', '', '', 'Pending', '', '', '', '', 'Pending'
         ]);
      });
      return createSuccessResponse();
    }

    if (action === 'lockAuditWH') {
      const sheet = getSheetSafe('AuditTask');
      const aData = sheet.getDataRange().getValues();
      for(let i=1; i<aData.length; i++) {
         if(String(aData[i][0]) === String(data.taskId)) {
            if(data.wh === 'TRD') {
               if(String(aData[i][8]) === 'Pending' || String(aData[i][8]) === 'Counting') {
                  sheet.getRange(i+1, 9).setValue('Counting');
                  sheet.getRange(i+1, 11).setValue(data.user);
               }
            } else if(data.wh === 'AKRA') {
               if(String(aData[i][11]) === 'Pending' || String(aData[i][11]) === 'Counting') {
                  sheet.getRange(i+1, 12).setValue('Counting');
                  sheet.getRange(i+1, 14).setValue(data.user);
               }
            }
         }
      }
      return createSuccessResponse();
    }

    if (action === 'submitAuditCount') {
      const sheet = getSheetSafe('AuditTask');
      
      // สร้างเวลาตอนที่ส่งยอดนับ (เช่น 14:30)
      const timeStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm");
      
      data.counts.forEach(c => {
         const rowNum = findRowByUID(sheet, c.rowId, 4); // rowId is col E (idx 4)
         if(rowNum > -1) {
            if(data.wh === 'TRD') {
               sheet.getRange(rowNum, 9).setValue('Done'); // trdStatus
               sheet.getRange(rowNum, 10).setValue(c.qty); // trdCountQty
               
               // อัปเดตคอลัมน์ชื่อคนนับให้มีเวลาต่อท้าย (เช่น User||14:30)
               const currentBy = String(sheet.getRange(rowNum, 11).getValue() || '');
               if(currentBy && currentBy.split('|').length < 3) {
                   sheet.getRange(rowNum, 11).setValue(currentBy + '|' + timeStr); 
               }

            } else if(data.wh === 'AKRA') {
               sheet.getRange(rowNum, 12).setValue('Done'); // akraStatus
               sheet.getRange(rowNum, 13).setValue(c.qty); // akraCountQty
               
               // อัปเดตคอลัมน์ชื่อคนนับให้มีเวลาต่อท้าย (เช่น User|W2|14:30)
               const currentBy = String(sheet.getRange(rowNum, 14).getValue() || '');
               if(currentBy && currentBy.split('|').length < 3) {
                   sheet.getRange(rowNum, 14).setValue(currentBy + '|' + timeStr); 
               }
            }
         }
      });
      
      SpreadsheetApp.flush();
      const aData = sheet.getDataRange().getValues();
      let taskItems = aData.filter(r => String(r[0]) === String(data.taskId));
      let allDone = true;
      taskItems.forEach(r => {
         const targetWH = String(r[3]);
         const tDone = String(r[8]) === 'Done';
         const aDone = String(r[11]) === 'Done';
         if(targetWH === 'BOTH' && (!tDone || !aDone)) allDone = false;
         if(targetWH === 'TRD' && !tDone) allDone = false;
         if(targetWH === 'AKRA' && !aDone) allDone = false;
      });
      
      if(allDone) {
         for(let i=1; i<aData.length; i++) {
            if(String(aData[i][0]) === String(data.taskId)) {
               sheet.getRange(i+1, 17).setValue('Reviewing'); // overallStatus
            }
         }
      }
      
      return createSuccessResponse();
    }

    if (action === 'finalizeAudit') {
      const sheet = getSheetSafe('AuditTask');
      data.reviews.forEach(r => {
         const rowNum = findRowByUID(sheet, r.rowId, 4);
         if(rowNum > -1) {
            sheet.getRange(rowNum, 15).setValue(r.sysStock);
            sheet.getRange(rowNum, 16).setValue(r.stockDiff);
            sheet.getRange(rowNum, 17).setValue('Completed');
         }
      });
      return createSuccessResponse();
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Unknown Action'})).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // ถ้าจับ Error ได้จาก getSheetSafe จะเด้งข้อความให้เห็นชัดๆ บนหน้าจอทันที
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 🛠️ ฟังก์ชันเสริม (Helpers)
// ==========================================
function findRowByUID(sheet, targetId, colIndex) {
  if (!sheet) return -1;
  const rows = sheet.getDataRange().getValues();
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][colIndex]) === String(targetId)) return r + 1;
  }
  return -1;
}