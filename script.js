// Klein script voor snelle UX
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const form = document.getElementById('searchForm');
const q = document.getElementById('q');
const pills = document.querySelectorAll('.pill, .card');

function submitWith(query) {
  if (!q) return;
  q.value = query;
  // Hier later koppelen met echte resultaten/agenda
  alert(`Zoeken naar: ${query}`);
}

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  submitWith(q.value.trim());
});

pills.forEach(el => el.addEventListener('click', (e) => {
  e.preventDefault();
  const query = el.dataset.query || el.textContent.trim();
  submitWith(query);
}));
// Forceer openen van de native kalender bij klik op het veld of op het icoon-gedeelte
document.querySelectorAll('input[type="date"]').forEach((el)=>{
  // Klik rechts op het icoon-gedeelte? -> open picker (Chromium ondersteunt showPicker)
  el.addEventListener('click', () => {
    if (typeof el.showPicker === 'function') el.showPicker();
  });
  // Enter/Space opent ook
  el.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.code === 'Space') && typeof el.showPicker === 'function'){
      e.preventDefault(); el.showPicker();
    }
  });
});
(function(){
  const k='vp_admin_token';
  let ok=false;
  try{
    const t=JSON.parse(localStorage.getItem(k)||'null');
    ok=t && t.ok && (Date.now()-t.t)<24*60*60*1000;
  }catch(e){}
  const el=document.querySelector('.admin-link');
  if(el) el.classList.toggle('show', !!ok);
})();
(function(){
  const k='vp_admin_token';
  let ok=false;
  try{
    const t=JSON.parse(localStorage.getItem(k)||'null');
    ok=t && t.ok && (Date.now()-t.t)<24*60*60*1000;
  }catch(e){}
  const el=document.querySelector('.admin-link');
  if(el) el.classList.toggle('show', !!ok);
})();
function trackView(businessId){
  if(!businessId) return;
  const body = JSON.stringify({ businessId });
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/.netlify/functions/track-view", blob);
  } else {
    fetch("/.netlify/functions/track-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true
    });
  }
}
function trackView(businessId){
  if(!businessId) return;
  const body = JSON.stringify({ businessId });
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/.netlify/functions/track-view", blob);
  } else {
    fetch("/.netlify/functions/track-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true
    });
  }
}

document.addEventListener("click",(e)=>{
  const a=e.target.closest("a.card[data-id]");
  if(!a) return;
  trackView(a.dataset.id);
});
