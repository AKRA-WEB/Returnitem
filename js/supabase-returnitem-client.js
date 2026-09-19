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
        if (typeof window !== 'undefined' && window.AkraModule?.embedded) return window.AkraModule.getToken();
        if (typeof appUser !== 'undefined' && appUser && appUser.token) return appUser.token;
        if (typeof window !== 'undefined' && window.appUser && window.appUser.token) return window.appUser.token;
        return '';
    }

    function getOwner() {
        if (typeof appUser !== 'undefined') return appUser;
        return typeof window !== 'undefined' ? window.appUser : null;
    }
    function assertCurrentSession(owner, token) {
        if (!owner || owner !== getOwner() || !token || token !== getToken()) {
            throw Object.assign(new Error('บัญชีหรือเซสชันเปลี่ยนแล้ว กรุณาเปิดแอปจาก Main ใหม่'), { reason:'session_changed' });
        }
    }

    async function apiCall(action, payload = {}, explicitToken = '') {
        const operation = () => transportRequest(action, payload, explicitToken);
        const bridge = typeof window !== 'undefined' && window.AkraModule?.embedded ? window.AkraModule : null;
        return bridge && !action.startsWith('get') ? bridge.runMutation(operation) : operation();
    }

    async function transportRequest(action, payload, explicitToken) {
        const token = typeof window !== 'undefined' && window.AkraModule?.embedded ? getToken() : explicitToken || getToken();
        const owner = getOwner();
        assertCurrentSession(owner, token);
        const res = await fetch(SUPABASE_CONFIG.FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ ...payload, action, token })
        });
        const result = res.ok ? await res.json() : await res.json().catch(() => ({ message: res.statusText }));
        assertCurrentSession(owner, token);
        if (!res.ok) {
            const err = result;
            throw Object.assign(new Error(err.message || 'API request failed'), { status: res.status, reason: err.reason });
        }
        return result;
    }

    return {
        // Core reads
        getInitialData: (token, limit = 300, options = {}) => apiCall('getInitialData', { limit, ...(typeof options.includeClaimDetails === 'boolean' ? { includeClaimDetails: options.includeClaimDetails } : {}) }, token),
        getClaimBillForPrint: (payload, token) => apiCall('getClaimBillForPrint', payload, token),
        getClaimBillHistory: (payload, token) => apiCall('getClaimBillHistory', payload, token),
        searchProducts: async (q, limit = 25) => {
            const url = `${SUPABASE_CONFIG.FUNCTION_URL}?action=searchProducts&q=${encodeURIComponent(q || '')}&limit=${limit}`;
            const token = getToken();
            const owner = getOwner();
            assertCurrentSession(owner, token);
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const result = await res.json();
            assertCurrentSession(owner, token);
            if (!res.ok) throw new Error('Search failed');
            return result;
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
        updateClaimBillItems: (payload, token) => apiCall('updateClaimBillItems', payload, token),
        updateClaimBillStatus: (payload, token) => apiCall('updateClaimBillStatus', payload, token),
        cancelClaimBill: (payload, token) => apiCall('cancelClaimBill', payload, token)
    };
}));
