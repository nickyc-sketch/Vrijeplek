
const $ = s => document.querySelector(s);
document.addEventListener('DOMContentLoaded',()=>{
  const identity = window.netlifyIdentity;
  const loginLink = document.getElementById('loginLink');
  const logoutLink = document.getElementById('logoutLink');
  if (identity){
    identity.on('init', user => {
      if (user){
        if (loginLink) loginLink.style.display='none';
        if (logoutLink){ logoutLink.style.display='inline-flex'; logoutLink.onclick=()=>identity.logout(); }
        const emailSpan = document.getElementById('uEmail'); if (emailSpan) emailSpan.textContent = user.email;
        if (location.pathname.endsWith('login.html')) window.location.href = 'dashboard.html';
      } else {
        if (logoutLink) logoutLink.style.display='none';
        if (loginLink) loginLink.style.display='inline-flex';
        if (location.pathname.endsWith('dashboard.html')) window.location.href = 'login.html';
      }
    });
    identity.init();
  }

  const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

  // Results placeholder
  const results = document.getElementById('results');
  if (results){
    const p = new URLSearchParams(location.search);
    const q = p.get('q')||'', cat=p.get('cat')||'', loc=p.get('loc')||'';
    results.innerHTML = `<div class="card"><h3>Zoekopdracht</h3><p class="muted">q="${q}" · cat="${cat}" · loc="${loc}"</p><p>Resultaten komen hier te staan zodra bedrijven live zijn.</p></div>`;
  }
});

function handleSearch(){
  const q = ($('#q')||{}).value || '';
  const cat = ($('#cat')||{}).value || '';
  const loc = ($('#loc')||{}).value || '';
  const params = new URLSearchParams({ q, cat, loc });
  window.location.href = `results.html?${params.toString()}`;
}

// Maintain chosen plan between pages
let SELECTED_PLAN = localStorage.getItem('plan') || null;
function selectPlan(plan){ SELECTED_PLAN = plan; localStorage.setItem('plan', plan); }

// Signup → Stripe Checkout
async function startSignup(e){
  e.preventDefault();
  if (!SELECTED_PLAN){ alert('Kies eerst een plan links.'); return false; }
  if (!document.getElementById('agree').checked){ alert('Je moet akkoord gaan met de Algemene voorwaarden.'); return false; }
  const payload = {
    plan: SELECTED_PLAN,
    company: document.getElementById('company').value,
    vat: document.getElementById('vat').value,
    category: document.getElementById('category').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone')?.value || '',
    reviews: document.getElementById('reviews')?.value || '',
    address: document.getElementById('address')?.value || '',
    bio: document.getElementById('bio')?.value || '',
  };
  try{
    const res = await fetch('/.netlify/functions/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.url){ location.href = data.url; } else alert('Kon geen betaalpagina openen.');
  }catch(err){ alert('Fout bij starten betaling: '+err.message); }
  return false;
}

// Slots CRUD
async function syncSlots(){
  const res = await fetch('/.netlify/functions/slots-list');
  const data = await res.json();
  const table = document.getElementById('slotsTable');
  if (!Array.isArray(data) || !data.length){ table.innerHTML = '<tr><td>Geen slots</td></tr>'; return; }
  table.innerHTML = data.map(s=>`<tr><td>${s.when}</td><td>${s.status||'Vrij'}</td><td><button class="button" onclick="delSlot('${s.id}')">Verwijder</button></td></tr>`).join('');
}
async function addSlot(){
  const when = prompt('Wanneer? (bv. 2025-10-10 14:30)');
  if (!when) return;
  await fetch('/.netlify/functions/slots-upsert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({when, status:'Vrij'})});
  syncSlots();
}
async function delSlot(id){
  await fetch('/.netlify/functions/slots-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  syncSlots();
}
async function saveProfile(){ alert('Profiel bewaard'); }
if (location.pathname.endsWith('dashboard.html')){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(syncSlots, 300));
}
