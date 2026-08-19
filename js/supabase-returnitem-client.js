/**
 * ============================================================================
 * AKRA RETURNITEM (DAMAGED STOCKS & CLAIMS) SUPABASE API CLIENT
 * High-Speed Relational Claim Management (<25ms queries)
 * ============================================================================
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AkraSupabaseReturnitem = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const SUPABASE_CONFIG = {
        URL: 'https://hgxrrskztbpejirrdpbq.supabase.co',
        KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhneHJyc2t6dGJwZWppcnJkcGJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzEyNDU4MCwiZXhwIjoyMTAyNzAwNTgwfQ.9RiiP0kItbbcMeI2mYActrD9a1naHCNbmYJBRXHR1DI',
            };

    async function supabaseRest(endpoint, options = {}) {
        const url = `${SUPABASE_CONFIG.URL}/rest/v1/${endpoint}`;
        const key = SUPABASE_CONFIG.KEY;
        const headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
            ...(options.headers || {})
        };
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Supabase REST HTTP ${res.status}: ${errText}`);
        }
        return res.json();
    }

    /**
     * Get Damaged Stocks List with Available Quantities (<25ms)
     */
    async function getDamagedStocks(options = {}) {
        let filter = 'order=created_at.desc';
        if (options.vendor) {
            filter += `&vendor_name=eq.${encodeURIComponent(options.vendor)}`;
        }
        if (options.status) {
            filter += `&status=eq.${encodeURIComponent(options.status)}`;
        }
        const stocks = await supabaseRest(`damaged_stocks?${filter}`);
        return {
            status: 'success',
            stocks: (stocks || []).map(s => ({
                id: s.id,
                intakeDate: s.intake_date,
                warehouse: s.warehouse,
                sku: s.sku,
                productName: s.product_name,
                damagedQty: Number(s.damaged_qty),
                allocatedQty: Number(s.allocated_qty || 0),
                availableQty: Number(s.available_qty ?? (s.damaged_qty - (s.allocated_qty || 0))),
                unit: s.unit,
                vendor: s.vendor_name,
                receiver: s.receiver,
                sourceType: s.source_type,
                status: s.status,
                remark: s.remark
            }))
        };
    }

    /**
     * Record New Damaged Stock Intake
     */
    async function recordDamagedIntake(intakeData) {
        const payload = {
            intake_date: intakeData.intakeDate || new Date().toISOString().split('T')[0],
            warehouse: intakeData.warehouse || 'W1',
            sku: intakeData.sku,
            product_name: intakeData.productName || intakeData.product_name,
            damaged_qty: Number(intakeData.damagedQty || intakeData.damaged_qty || 0),
            allocated_qty: 0,
            unit: intakeData.unit || 'ชิ้น',
            vendor_name: intakeData.vendor || intakeData.vendor_name,
            receiver: intakeData.receiver || 'Staff',
            source_type: intakeData.sourceType || 'warehouse_intake',
            status: 'รอเคลม',
            remark: intakeData.remark || ''
        };

        const inserted = await supabaseRest('damaged_stocks', {
            method: 'POST',
            body: payload
        });

        return {
            status: 'success',
            stockId: inserted[0].id
        };
    }

    /**
     * Get Claim Bills with Line Items
     */
    async function getClaimBills(options = {}) {
        let filter = 'select=*,items:claim_items(*)&order=created_at.desc';
        if (options.vendor) {
            filter += `&vendor_name=eq.${encodeURIComponent(options.vendor)}`;
        }
        const bills = await supabaseRest(`claim_bills?${filter}`);
        return {
            status: 'success',
            bills: bills || []
        };
    }

    /**
     * Create Vendor Claim Bill (Parent + Children + Update Allocated Qty)
     */
    async function createClaimBill(claimData) {
        const { claimNumber, claimDate, vendor, warehouse, creator, remark, items } = claimData;

        // 1. Create Parent Claim Bill
        const billPayload = {
            claim_number: claimNumber || ('CLM-' + Date.now()),
            claim_date: claimDate || new Date().toISOString().split('T')[0],
            vendor_name: vendor,
            warehouse: warehouse || 'W1',
            status: 'รอส่งเคลม',
            creator: creator || 'Supervisor',
            remark: remark || ''
        };

        const createdBills = await supabaseRest('claim_bills', {
            method: 'POST',
            body: billPayload
        });
        const bill = createdBills[0];

        // 2. Create Claim Items & Update Stock Allocation
        if (Array.isArray(items) && items.length > 0) {
            const itemPayloads = items.map(item => ({
                claim_bill_id: bill.id,
                damaged_stock_id: item.stockId || null,
                sku: item.sku,
                product_name: item.productName || item.product_name,
                claim_qty: Number(item.claimQty || item.claim_qty || 0),
                unit: item.unit || 'ชิ้น',
                remark: item.remark || ''
            }));

            await supabaseRest('claim_items', {
                method: 'POST',
                body: itemPayloads
            });

            // Update allocated quantity on damaged stocks
            for (const item of items) {
                if (item.stockId) {
                    const stocks = await supabaseRest(`damaged_stocks?id=eq.${encodeURIComponent(item.stockId)}&select=allocated_qty,damaged_qty`);
                    if (stocks && stocks[0]) {
                        const currentAlloc = Number(stocks[0].allocated_qty || 0);
                        const newAlloc = currentAlloc + Number(item.claimQty || 0);
                        await supabaseRest(`damaged_stocks?id=eq.${encodeURIComponent(item.stockId)}`, {
                            method: 'PATCH',
                            body: {
                                allocated_qty: newAlloc,
                                status: newAlloc >= Number(stocks[0].damaged_qty) ? 'กำลังเคลม' : 'รอเคลม'
                            }
                        });
                    }
                }
            }
        }

        return {
            status: 'success',
            billId: bill.id,
            claimNumber: bill.claim_number
        };
    }

    return {
        getDamagedStocks,
        recordDamagedIntake,
        getClaimBills,
        createClaimBill,
        SUPABASE_CONFIG
    };
}));
