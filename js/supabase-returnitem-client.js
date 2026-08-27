/**
 * ============================================================================
 * AKRA RETURNITEM SUPABASE API CLIENT (Zero-GAS Production)
 * Routes all Returnitem domain operations through Supabase Edge Function: returnitem-api
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
        FUNCTION_URL: 'https://hgxrrskztbpejirrdpbq.supabase.co/functions/v1/returnitem-api'
    };

    function getToken() {
        if (typeof appUser !== 'undefined' && appUser && appUser.token) return appUser.token;
        if (typeof window !== 'undefined' && window.appUser && window.appUser.token) return window.appUser.token;
        return '';
    }

    async function apiCall(action, payload = {}, explicitToken = '') {
        const token = explicitToken || getToken();
        const res = await fetch(SUPABASE_CONFIG.FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ action, ...payload, token })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw Object.assign(new Error(err.message || 'API request failed'), { status: res.status, reason: err.reason });
        }
        return await res.json();
    }

    return {
        // Core reads
        getInitialData: (token, limit = 300) => apiCall('getInitialData', { limit }, token),
        searchProducts: async (q, limit = 25) => {
            const url = `${SUPABASE_CONFIG.FUNCTION_URL}?action=searchProducts&q=${encodeURIComponent(q || '')}&limit=${limit}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Search failed');
            return await res.json();
        },

        // Customer Returns
        recordReturn: (payload, token) => apiCall('addReturn', payload, token),
        recordReturnWithClaim: (payload, token) => apiCall('addReturnWithClaim', payload, token),
        updateReturnQC: (payload, token) => apiCall('updateReturnQC', payload, token),
        updateReturnBatch: (payload, token) => apiCall('updateReturnBatch', payload, token),
        closeCustomerReturn: (payload, token) => apiCall('closeCustomerReturn', payload, token),

        // Damaged Stocks
        recordDamagedIntake: (payload, token) => apiCall('recordDamagedIntake', payload, token),
        bulkIntakeDamaged: (payload, token) => apiCall('bulkIntakeDamaged', payload, token),
        confirmWHReceive: (payload, token) => apiCall('confirmWHReceive', payload, token),
        triageClaim: (payload, token) => apiCall('triageClaim', payload, token),
        deleteClaim: (payload, token) => apiCall('deleteClaim', payload, token),
        updateVendor: (payload, token) => apiCall('updateVendor', payload, token),

        // Claim Bills
        createClaimBill: (payload, token) => apiCall('createClaimBill', payload, token),
        submitClaimBill: (payload, token) => apiCall('submitClaimBill', payload, token),
        updateClaimBillStatus: (payload, token) => apiCall('updateClaimBillStatus', payload, token),
        cancelClaimBill: (payload, token) => apiCall('cancelClaimBill', payload, token),

        // Audits
        createAudit: (payload, token) => apiCall('createAudit', payload, token),
        submitAuditCount: (payload, token) => apiCall('submitAuditCount', payload, token),
        finalizeAudit: (payload, token) => apiCall('finalizeAudit', payload, token),
        saveDraft: (payload, token) => apiCall('saveDraft', payload, token),
        deleteDraft: (payload, token) => apiCall('deleteDraft', payload, token)
    };
}));
