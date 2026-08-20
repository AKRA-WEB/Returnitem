/**
 * ============================================================================
 * AKRA RETURNITEM SUPABASE API CLIENT
 * Status: DEACTIVATED / CONTAINED for Security Hardening (Plan 20260820-004)
 * Damaged stock and claim bill operations execute via authoritative backend (GAS).
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
        KEY: ''
    };

    return {
        recordDamagedIntake: async () => { throw new Error('Supabase Returnitem client deactivated. Falling back to GAS.'); },
        getDamagedStocks: async () => { throw new Error('Supabase Returnitem client deactivated. Falling back to GAS.'); },
        createClaimBill: async () => { throw new Error('Supabase Returnitem client deactivated. Falling back to GAS.'); },
        getClaimBills: async () => { throw new Error('Supabase Returnitem client deactivated. Falling back to GAS.'); }
    };
}));
