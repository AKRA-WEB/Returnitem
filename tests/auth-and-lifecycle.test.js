const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

console.log("=== RUNNING RETURNITEM AUTH & LIFECYCLE TESTS ===\n");

const htmlPath = path.join(__dirname, "..", "index.html");
const versionPath = path.join(__dirname, "..", "version.json");
const html = fs.readFileSync(htmlPath, "utf8");
const versionJson = JSON.parse(fs.readFileSync(versionPath, "utf8"));

// Test 1: Version parity check
console.log("[Test 1] Version Parity Check...");
const versionMatch = html.match(/const CURRENT_VERSION = "(.*?)";/);
assert.ok(versionMatch, "CURRENT_VERSION must exist in index.html");
assert.strictEqual(versionMatch[1], versionJson.version, "CURRENT_VERSION in index.html must match version.json");
assert.strictEqual(versionJson.version, "20260820.04", "Version must be 20260820.04");
console.log("  -> PASS: Version is " + versionJson.version);

// Test 2: Parse and compile all script blocks
console.log("\n[Test 2] Script Block Syntax & Compilation...");
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIndex = 0;
while ((match = scriptRegex.exec(html)) !== null) {
    scriptIndex++;
    const code = match[1];
    if (!code.trim()) continue;
    try {
        new vm.Script(code);
        console.log("  -> Script block " + scriptIndex + " compiled successfully.");
    } catch (err) {
        assert.fail("Script block " + scriptIndex + " failed compilation: " + err.message);
    }
}

const ssoScriptMatch = html.match(/<!-- 🔐 SSO Access Control -->[\s\S]*?<script>([\s\S]*?)<\/script>/);
assert.ok(ssoScriptMatch, "SSO script block must exist");
const ssoCode = ssoScriptMatch[1];

function createSandbox(overrides = {}) {
    const sandbox = {
        window: {
            location: { search: "", pathname: "/Returnitem/", hostname: "akra-web.github.io" },
            history: { replaceState: () => {} },
            self: null,
            top: null,
            ...(overrides.window || {})
        },
        document: {
            title: "Test",
            createElement: () => ({ id: "", setAttribute: () => {}, appendChild: () => {}, querySelector: () => null }),
            getElementById: () => null,
            head: { appendChild: () => {} },
            body: { appendChild: () => {} },
            ...(overrides.document || {})
        },
        localStorage: {
            _data: {},
            getItem(key) { return this._data[key] || null; },
            setItem(key, val) { this._data[key] = String(val); },
            removeItem(key) { delete this._data[key]; },
            ...(overrides.localStorage || {})
        },
        URLSearchParams,
        URL,
        atob: (b64) => Buffer.from(b64, "base64").toString("binary"),
        TextDecoder,
        Uint8Array,
        Buffer,
        console: { log: () => {}, warn: () => {}, error: () => {} },
        alert: (msg) => { sandbox.lastAlert = msg; },
        fetch: overrides.fetch || (async () => ({ ok: true, json: async () => ({ valid: true, user: { id: "admin-1", name: "Admin", roles: ["ADMIN"] } }) })),
        lastAlert: null,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval
    };
    sandbox.window.self = sandbox.window;
    sandbox.window.top = sandbox.window;
    return sandbox;
}

function makeJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return header + "." + body + ".mockSignature";
}

console.log("\n[Test 3] decodeJwtPayload Unit Tests...");
const ctx3 = vm.createContext(createSandbox());
vm.runInContext(ssoCode, ctx3);

const validPayload = { id: "user-1", name: "Somchai", roles: ["AKRA"], exp: Math.floor(Date.now() / 1000) + 3600 };
const validToken = makeJwt(validPayload);
const decoded = ctx3.decodeJwtPayload(validToken);
assert.strictEqual(JSON.stringify(decoded.id), JSON.stringify("user-1"));
assert.strictEqual(JSON.stringify(decoded.name), JSON.stringify("Somchai"));
assert.strictEqual(JSON.stringify(decoded.roles), JSON.stringify(["AKRA"]));
console.log("  -> PASS: Decoded valid token correctly");

assert.strictEqual(ctx3.decodeJwtPayload("invalid.token"), null, "Malformed token must return null");
assert.strictEqual(ctx3.decodeJwtPayload(null), null, "Null token must return null");
assert.strictEqual(ctx3.decodeJwtPayload(""), null, "Empty token must return null");
console.log("  -> PASS: Malformed tokens return null");

const expiredPayload = { id: "user-2", name: "ExpiredUser", roles: ["ADMIN"], exp: Math.floor(Date.now() / 1000) - 100 };
const expiredToken = makeJwt(expiredPayload);
assert.strictEqual(ctx3.decodeJwtPayload(expiredToken), null, "Expired token must return null");
console.log("  -> PASS: Expired token returns null");

async function runAsyncTests() {
    console.log("\n[Test 4] verifyAccess() with valid SSO URL parameter...");
    const ssoTokenAdmin = makeJwt({ id: "admin-01", name: "Super Admin", roles: ["ADMIN"], perms: { "app-ret": ["ADD_CLM", "WH_CLM", "MANAGE_CLM"] }, exp: Math.floor(Date.now() / 1000) + 86400 });
    const sb4 = createSandbox({
        window: { location: { search: "?sso=" + ssoTokenAdmin, pathname: "/Returnitem/", hostname: "akra-web.github.io" } }
    });
    const ctx4 = vm.createContext(sb4);
    vm.runInContext(ssoCode, ctx4);
    const access4 = await ctx4.verifyAccess();
    assert.strictEqual(access4, true, "verifyAccess must return true for valid Admin token");
    assert.strictEqual(vm.runInContext("appUser", ctx4).name, "Super Admin");
    assert.strictEqual(JSON.stringify(vm.runInContext("appUser", ctx4).roles), JSON.stringify(["ADMIN"]));
    assert.strictEqual(JSON.stringify(vm.runInContext("appUser", ctx4).perms), JSON.stringify({ "app-ret": ["ADD_CLM", "WH_CLM", "MANAGE_CLM"] }));
    console.log("  -> PASS: Instant SSO verification succeeded with permissions attached");

    console.log("\n[Test 5] verifyAccess() with non-admin allowed role (Cashier)...");
    const ssoTokenCashier = makeJwt({ id: "cashier-01", name: "Cashier Staff", roles: ["Cashier"], exp: Math.floor(Date.now() / 1000) + 86400 });
    const sb5 = createSandbox({
        window: { location: { search: "?sso=" + ssoTokenCashier, pathname: "/Returnitem/", hostname: "akra-web.github.io" } }
    });
    const ctx5 = vm.createContext(sb5);
    vm.runInContext(ssoCode, ctx5);
    const access5 = await ctx5.verifyAccess();
    assert.strictEqual(access5, true, "verifyAccess must return true for Cashier");
    assert.strictEqual(vm.runInContext("appUser", ctx5).name, "Cashier Staff");
    console.log("  -> PASS: Cashier role accepted");

    console.log("\n[Test 6] Negative Case: Unauthorized role in JWT token...");
    const ssoTokenUnauthorized = makeJwt({ id: "guest-01", name: "Guest", roles: ["GUEST"], exp: Math.floor(Date.now() / 1000) + 86400 });
    let redirectedToPortal = false;
    const sb6 = createSandbox({
        window: {
            location: {
                search: "?sso=" + ssoTokenUnauthorized,
                pathname: "/Returnitem/",
                hostname: "akra-web.github.io",
                replace: (url) => { if (url.includes("MainPortal")) redirectedToPortal = true; }
            }
        },
        fetch: async () => ({ ok: true, json: async () => ({ valid: false }) })
    });
    const ctx6 = vm.createContext(sb6);
    vm.runInContext(ssoCode, ctx6);
    const access6 = await ctx6.verifyAccess();
    assert.strictEqual(access6, false, "verifyAccess must return false for unauthorized role");
    assert.strictEqual(redirectedToPortal, true, "Must redirect unauthorized user to MainPortal");
    console.log("  -> PASS: Unauthorized role safely rejected and redirected to portal");

    console.log("\n[Test 7] Negative Case: No token and no saved data on production host...");
    let redirect7 = false;
    const sb7 = createSandbox({
        window: {
            location: {
                search: "",
                pathname: "/Returnitem/",
                hostname: "akra-web.github.io",
                replace: (url) => { if (url.includes("MainPortal")) redirect7 = true; }
            }
        }
    });
    const ctx7 = vm.createContext(sb7);
    vm.runInContext(ssoCode, ctx7);
    const access7 = await ctx7.verifyAccess();
    assert.strictEqual(access7, false, "verifyAccess must return false when unauthenticated");
    assert.strictEqual(redirect7, true, "Must redirect unauthenticated user to MainPortal");
    console.log("  -> PASS: Unauthenticated access rejected and redirected");

    console.log("\n[Test 8] Preview / Mock Mode...");
    const sb8 = createSandbox({
        window: { location: { search: "", pathname: "/Returnitem/", hostname: "localhost" } }
    });
    const ctx8 = vm.createContext(sb8);
    vm.runInContext(ssoCode, ctx8);
    const access8 = await ctx8.verifyAccess();
    assert.strictEqual(access8, true, "Preview mode must grant mock access");
    assert.strictEqual(vm.runInContext("appUser", ctx8).id, "preview-admin");
    console.log("  -> PASS: Preview mode successfully initializes mock admin");

    console.log("\n[Test 9] verifyAccess() from localStorage cached session...");
    const sb9 = createSandbox({
        window: { location: { search: "", pathname: "/Returnitem/", hostname: "akra-web.github.io" } },
        localStorage: {
            _data: {
                akra_returnitem_session: JSON.stringify({
                    id: "saved-01",
                    name: "Saved User",
                    roles: ["AKRA"],
                    token: ssoTokenAdmin
                })
            },
            getItem(key) { return this._data[key] || null; },
            setItem(key, val) { this._data[key] = String(val); },
            removeItem(key) { delete this._data[key]; }
        }
    });
    const ctx9 = vm.createContext(sb9);
    vm.runInContext(ssoCode, ctx9);
    const access9 = await ctx9.verifyAccess();
    assert.strictEqual(access9, true, "Cached token in localStorage must succeed");
    assert.strictEqual(vm.runInContext("appUser", ctx9).id, "admin-01");
    console.log("  -> PASS: Restored session from localStorage verified via JWT decode");

    console.log("\n=== ALL 9 AUTH & LIFECYCLE TESTS PASSED! ===\n");
}

runAsyncTests().catch(err => {
    console.error("Test run failed:", err);
    process.exit(1);
});