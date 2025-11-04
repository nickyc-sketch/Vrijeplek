/**
 * Vrijeplek CI self-fixer
 * - Zorgt dat netlify.toml, package.json, helper en functions aanwezig zijn
 * - Maakt CJS-signup (compat) + ping + diag
 * - Zet ESLint/Prettier configs
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
function w(p, s){ fs.mkdirSync(path.dirname(p), { recursive:true }); fs.writeFileSync(p, s, 'utf8'); }
function exists(p){ return fs.existsSync(p); }
function mergeJSON(prev, patch){
  const out = { ...(prev||{}) };
  for (const [k,v] of Object.entries(patch)){
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = mergeJSON(out[k] || {}, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// 1) package.json
const pkgPath = path.join(ROOT, 'package.json');
let pkg = exists(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath,'utf8')) : {};
pkg = mergeJSON(pkg, {
  name: pkg.name || "vrijeplek",
  private: true,
  version: pkg.version || "1.0.0",
  scripts: Object.assign({
    "dev": "netlify dev",
    "lint": "eslint . --ext .js",
    "format": "prettier -w .",
  }, pkg.scripts || {}),
  dependencies: Object.assign({
    "@supabase/supabase-js": pkg?.dependencies?.["@supabase/supabase-js"] || "^2.45.0"
  }, pkg.dependencies || {}),
  // VERWIJDER GEEN "type": "module" toevoegen → repo gebruikt CJS in Functions
});
w(pkgPath, JSON.stringify(pkg, null, 2));

// 2) netlify.toml
const tomlPath = path.join(ROOT, 'netlify.toml');
const toml = `[build]
  command = ""
  publish = "."

[build.environment]
  NODE_VERSION = "20"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  external_node_modules = ["@supabase/supabase-js"]
  included_files = ["netlify/functions/_lib/**"]
`;
w(tomlPath, toml);

// 3) _lib/db.js helper
const libPath = path.join(ROOT, 'netlify/functions/_lib/db.js');
const lib = `const { createClient } = require('@supabase/supabase-js');

function json(status = 200, body = {}, headers = {}){
  return {
    statusCode: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function getClient(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or key');
  return createClient(url, key, { auth: { persistSession: false } });
}

module.exports = { json, getClient };
`;
w(libPath, lib);

// 4) signup.js (CJS compat, met CORS + timeout)
const signupPath = path.join(ROOT, 'netlify/functions/signup.js');
if (!exists(signupPath)){
  const signup = `const { createClient } = require('@supabase/supabase-js');

function isAllowedOrigin(origin){
  if (!origin) return false;
  try{
    const u = new URL(origin);
    const h = u.host;
    if (h === 'vrijeplek.be' || h === 'www.vrijeplek.be' || h === 'vrijeplek.netlify.app') return true;
    if (h.endsWith('--vrijeplek.netlify.app')) return true;
    return false;
  }catch{ return false; }
}
function allowOrigin(event){
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  return isAllowedOrigin(origin) ? origin : 'https://vrijeplek.netlify.app';
}
function json(status, body, headers){
  return {
    statusCode: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}
function withTimeout(promise, ms, label='timeout'){
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(label)), ms); })
  ]);
}

exports.handler = async (event) => {
  const originHeader = allowOrigin(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:204, headers: {
      'Access-Control-Allow-Origin': originHeader,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    }, body:'' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method' }, { 'Access-Control-Allow-Origin': originHeader });
  }

  let payload; try{ payload = JSON.parse(event.body || '{}'); }
  catch{ return json(400, { error:'invalid_json' }, { 'Access-Control-Allow-Origin': originHeader }); }

  const { email, password, full_name, company, vat } = payload || {};
  if (!email || !password) return json(400, { error:'missing_email_or_password' }, { 'Access-Control-Allow-Origin': originHeader });

  const site = (process.env.SITE_URL || '').replace(/\\/$/, '') || 'https://vrijeplek.netlify.app';
  const redirect = \`\${site}/geactiveerd.html\`;

  try{
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');

    const supa = createClient(url, key, { auth: { persistSession: false } });
    await withTimeout(
      supa.auth.signUp({ email, password, options: { emailRedirectTo: redirect, data: { full_name, company, vat } } }),
      8000, 'supabase_auth_signup_timeout'
    ).then(({ error }) => { if (error) throw new Error(error.message); });

    return json(200, { ok:true, redirect }, { 'Access-Control-Allow-Origin': originHeader });
  }catch(e){
    const status = String(e.message).includes('timeout') ? 504 : 500;
    return json(status, { error: e.message || 'signup_failed' }, { 'Access-Control-Allow-Origin': originHeader });
  }
};
`;
  w(signupPath, signup);
}

// 5) ping.js + diag.js
const pingPath = path.join(ROOT, 'netlify/functions/ping.js');
if (!exists(pingPath)){
  w(pingPath, `exports.handler = async () => ({ statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ok:true }) });`);
}
const diagPath = path.join(ROOT, 'netlify/functions/diag.js');
if (!exists(diagPath)){
  w(diagPath, `exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || null;
  const site = (process.env.SITE_URL || '').replace(/\\/$/, '') || null;
  return { statusCode:200, headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ time:new Date().toISOString(), origin, siteRedirect: site? \`\${site}/geactiveerd.html\`: null }) };
};`);
}

console.log('Self-fixer klaar. Als er iets ontbrak is het nu toegevoegd.');
