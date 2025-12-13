
console.log("INDEX LOGIC JS V6 LOADED");

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateHuman(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('nl-BE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const vpSearchState = {
  slotsById: {},
  profilesByEmail: {},
  currentResults: [],
};

function normalizeSearchResponse(data) {
  // A) Verwacht: { profiles:[...], slots:[...] }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    const slots = Array.isArray(data.slots) ? data.slots : [];
    return { profiles, slots };
  }

  // B) Jouw huidige backend: [ { email, zaak, ..., slots:[...] }, ... ]
  if (Array.isArray(data)) {
    const profiles = [];
    const slots = [];
    for (const item of data) {
      if (!item) continue;
      const email = (item.email || '').toLowerCase();
      if (email) profiles.push({ ...item, email });

      const arr = Array.isArray(item.slots) ? item.slots : [];
      for (const s of arr) {
        // zorg dat slot.email er altijd op staat
        slots.push({ ...s, email: s.email || email });
      }
    }
    return { profiles, slots };
  }

  return { profiles: [], slots: [] };
}

async function vpSearchSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const q = (form.q?.value || '').trim();
  const loc = (form.loc?.value || '').trim();
  const from = (form.from?.value || '').trim();
  const to = (form.to?.value || '').trim();
  const cat = (form.cat?.value || '').trim();

  const resultsSection = document.getElementById('results');
  const resultsList = document.getElementById('results-list');
  const resultsMeta = document.getElementById('results-meta');
  const resultsTitle = document.getElementById('results-title');
  const bookingMsg = document.getElementById('booking-msg');

  if (!resultsSection || !resultsList) return;

  resultsSection.hidden = false;
  resultsList.innerHTML = `<p style="color:#fff;">Bezig met zoeken…</p>`;
  if (resultsMeta) resultsMeta.textContent = '';
  if (resultsTitle) resultsTitle.textContent = 'Vrije plekken';
  if (bookingMsg) bookingMsg.textContent = '';

  const payload = { q, loc, from, to, cat };

  let raw;
  try {
    const res = await fetch('/.netlify/functions/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // probeer altijd nuttige fout te tonen
    const text = await res.text();
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = { error: text || 'Onbekende fout' };
    }

    if (!res.ok) {
      const msg =
        raw?.details ||
        raw?.message ||
        raw?.error ||
        `Search failed (${res.status})`;
      throw new Error(msg);
    }
  } catch (err) {
    console.error('SEARCH ERROR:', err);
    resultsList.innerHTML =
      `<p style="color:#fff;">Zoeken mislukt: ${esc(err.message || err)}</p>`;
    if (resultsMeta) resultsMeta.textContent = '0 resultaten';
    return;
  }

  const { profiles, slots } = normalizeSearchResponse(raw);

  vpSearchState.slotsById = {};
  vpSearchState.profilesByEmail = {};
  vpSearchState.currentResults = slots;

  profiles.forEach((p) => {
    const em = (p.email || '').toLowerCase();
    if (em) vpSearchState.profilesByEmail[em] = p;
  });

  slots.forEach((s) => {
    const id = s.id || s.slot_id;
    if (id) vpSearchState.slotsById[String(id)] = s;
  });

  if (!slots.length) {
    resultsList.innerHTML =
      `<p style="color:#fff;">Momenteel geen vrije plekken voor deze zoekopdracht.</p>`;
    if (resultsMeta) resultsMeta.textContent = '0 resultaten';
    return;
  }

  // groeperen per email
  const byEmail = {};
  for (const slot of slots) {
    const email = (slot.email || '').toLowerCase();
    if (!email) continue;
    (byEmail[email] ||= []).push(slot);
  }

  const htmlParts = [];

  Object.keys(byEmail).forEach((email) => {
    const prof = vpSearchState.profilesByEmail[email] || {};

    // ondersteun beide schema's
    const companyName =
      prof.company_name ||
      prof.zaak ||
      prof.business_name ||
      'Onbekende zaak';

    const city =
      prof.business_city ||
      prof.plaats ||
      prof.gemeente ||
      prof.city ||
      '';

    const catLabel =
      prof.cat_label ||
      prof.category_label ||
      prof.cat ||
      '';

    const slotsForProfile = byEmail[email].sort((a, b) => {
      const ad = a.date || a.slot_date || '';
      const bd = b.date || b.slot_date || '';
      const at = a.from || a.start || '';
      const bt = b.from || b.start || '';
      return (ad + at).localeCompare(bd + bt);
    });

    htmlParts.push(`
      <article class="result-card">
        <header class="result-head">
          <h3 style="color:#fff;">${esc(companyName)}</h3>
          <div class="result-meta" style="color:rgba(255,255,255,.85);">
            ${city ? `<span>${esc(city)}</span>` : ''}
            ${catLabel ? `<span>${esc(catLabel)}</span>` : ''}
          </div>
        </header>

        <div class="result-slots">
          ${slotsForProfile
            .map((slot) => {
              const id = slot.id || slot.slot_id;
              if (!id) return '';

              const date = slot.date || slot.slot_date;
              const fromTime = slot.from || slot.start;
              const toTime = slot.to || slot.end;

              const desc = slot.description || slot.desc || 'Vrije plek';

              const status = String(slot.status || '').toLowerCase();
              const isBooked =
                !!slot.booked_at ||
                slot.is_booked ||
                slot.booked ||
                status === 'geboekt' ||
                status === 'bezet' ||
                status === 'full' ||
                status === 'closed' ||
                status === 'booked' ||
                status === 'pending_deposit';

              const slotLabelDate = formatDateHuman(date);
              const timeLabel =
                fromTime && toTime ? `${fromTime} – ${toTime}` : (fromTime || '');

              // deposit info
              const slotDepositRequired = !!(slot.deposit_required || slot.with_deposit);
              const profileDepositEnabled = !!prof.deposit_enabled;
              const depositActive = slotDepositRequired || profileDepositEnabled;

              const depositAmount =
                slot.deposit_amount ??
                slot.depositAmount ??
                prof.deposit_amount ??
                null;

              const depositSnippet = depositActive
                ? `Voorschot${depositAmount ? ` ca. €${depositAmount}` : ''}`
                : 'Geen voorschot';

              if (isBooked) {
                return `
                  <div class="slot-card slot-card-full" data-slot-id="${esc(id)}">
                    <div class="slot-main">
                      <div class="slot-title" style="color:#fff;">${esc(slotLabelDate)}</div>
                      <div class="slot-time" style="color:rgba(255,255,255,.9);">${esc(timeLabel)}</div>
                      <div class="slot-desc" style="color:rgba(255,255,255,.9);">${esc(desc)}</div>
                      <div class="slot-meta" style="color:rgba(255,255,255,.75);">
                        <span>Volzet</span>
                      </div>
                    </div>
                    <div class="slot-actions">
                      <span class="slot-badge">Volzet</span>
                    </div>
                  </div>
                `;
              }

              return `
                <div class="slot-card" data-slot-id="${esc(id)}">
                  <div class="slot-main">
                    <div class="slot-title" style="color:#fff;">${esc(slotLabelDate)}</div>
                    <div class="slot-time" style="color:rgba(255,255,255,.9);">${esc(timeLabel)}</div>
                    <div class="slot-desc" style="color:rgba(255,255,255,.9);">${esc(desc)}</div>
                    <div class="slot-meta" style="color:rgba(255,255,255,.75);">
                      <span>${esc(depositSnippet)}</span>
                    </div>
                  </div>
                  <div class="slot-actions">
                    <button type="button"
                            class="btn-primary slot-book-btn"
                            data-slot-id="${esc(id)}">
                      Boek
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </article>
    `);
  });

  resultsList.innerHTML = htmlParts.join('');
  if (resultsMeta) resultsMeta.textContent = `${slots.length} open tijdstippen`;
}

// ---------- BOOKING MODAL ----------

let vpCurrentSlotId = null;

function vpOpenBookingModal(slotId) {
  const modal = document.getElementById('booking-modal');
  const slotSummaryEl = document.getElementById('booking-slot-summary');
  const depositHint = document.getElementById('booking-deposit-hint');
  const stepForm = document.getElementById('booking-step-form');
  const stepConfirm = document.getElementById('booking-step-confirm');
  const errorEl = document.getElementById('booking-error');

  if (!modal || !slotSummaryEl || !stepForm || !stepConfirm) return;

  const slot = vpSearchState.slotsById[String(slotId)];
  if (!slot) return;

  vpCurrentSlotId = String(slotId);

  const prof = vpSearchState.profilesByEmail[(slot.email || '').toLowerCase()] || {};
  const companyName = prof.company_name || prof.zaak || 'deze zaak';

  const dateLabel = formatDateHuman(slot.date || slot.slot_date);
  const fromTime = slot.from || slot.start;
  const toTime = slot.to || slot.end;
  const timeLabel = fromTime && toTime ? `${fromTime} – ${toTime}` : (fromTime || '');
  const desc = slot.description || slot.desc || '';

  slotSummaryEl.textContent = `${companyName}, ${dateLabel} • ${timeLabel} — ${desc}`;

  const slotDepositRequired = !!(slot.deposit_required || slot.with_deposit);
  const profileDepositEnabled = !!prof.deposit_enabled;
  const depositActive = slotDepositRequired || profileDepositEnabled;

  if (depositHint) depositHint.style.display = depositActive ? 'block' : 'none';
  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  stepForm.style.display = 'block';
  stepConfirm.style.display = 'none';

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function vpCloseBookingModal() {
  const modal = document.getElementById('booking-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  vpCurrentSlotId = null;
}

async function vpHandleBookingSubmit(e) {
  e.preventDefault();
  if (!vpCurrentSlotId) return;

    const form = e.target;
    const name = (form.name?.value || '').trim();
  const email = (form.email?.value || '').trim();
  const phone = (form.phone?.value || '').trim();
  const notes = (form.notes?.value || '').trim();

  const errorEl = document.getElementById('booking-error');
  const submitBtn = document.getElementById('booking-submit-btn');

  if (!name || !email || !phone) {
    if (errorEl) {
      errorEl.textContent = 'Vul naam, e-mailadres en telefoon in.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  const slot = vpSearchState.slotsById[String(vpCurrentSlotId)];
  const prof = slot ? vpSearchState.profilesByEmail[(slot.email || '').toLowerCase()] || {} : {};

  const payload = { slot_id: vpCurrentSlotId, name, email, phone, notes };
  const termsOk = !!form.terms?.checked;
  if (!termsOk) {
  if (errorEl) {
    errorEl.textContent = 'Je moet akkoord gaan met de algemene voorwaarden.';
    errorEl.style.display = 'block';
  }
  return;
}

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Bezig met boeken…'; }

  let resData;
  try {
    const res = await fetch('/.netlify/functions/book-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    try { resData = text ? JSON.parse(text) : {}; }
    catch { resData = { error: text || 'Onbekende fout' }; }

    if (!res.ok || resData.error) {
      throw new Error(resData.error || resData.message || `Boeking faalde (${res.status})`);
    }
  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent = err.message || 'Boeking mislukt.';
      errorEl.style.display = 'block';
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Boeking bevestigen'; }
    return;
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Boeking bevestigen'; }

  const stepForm = document.getElementById('booking-step-form');
  const stepConfirm = document.getElementById('booking-step-confirm');
  const confirmText = document.getElementById('booking-confirm-text');
  const depositBlock = document.getElementById('booking-deposit-block');

  if (!stepForm || !stepConfirm || !confirmText) return;

  stepForm.style.display = 'none';
  stepConfirm.style.display = 'block';

  const companyName = prof.company_name || prof.zaak || 'deze zaak';
  confirmText.textContent =
    `Je aanvraag is verstuurd naar ${companyName}. Je ontvangt nog een bevestiging van de zaak zelf.`;

  const depositInfo = resData.deposit || null;
  if (depositInfo && depositBlock) {
    const ibanEl = document.getElementById('deposit-iban');
    const bicEl = document.getElementById('deposit-bic');
    const amtEl = document.getElementById('deposit-amount');
    const msgEl = document.getElementById('deposit-message');
    const textEl = document.getElementById('deposit-text');

    if (ibanEl) ibanEl.textContent = depositInfo.iban || '';
    if (bicEl) bicEl.textContent = depositInfo.bic || '—';
    if (amtEl) amtEl.textContent = depositInfo.amount ? `€${depositInfo.amount}` : '';
    if (msgEl) msgEl.textContent = depositInfo.message || '';
    if (textEl) textEl.textContent =
      'Gelieve het voorschot zo snel mogelijk over te schrijven met onderstaande gegevens.';

    depositBlock.style.display = 'block';
  } else if (depositBlock) {
    depositBlock.style.display = 'none';
  }
}

// ---------- INIT ----------

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form');
  if (form) form.addEventListener('submit', vpSearchSubmit);

  const resultsList = document.getElementById('results-list');
  if (resultsList) {
    resultsList.addEventListener('click', (e) => {
      const btn = e.target.closest('.slot-book-btn');
      if (!btn) return;
      const slotId = btn.getAttribute('data-slot-id');
      if (!slotId) return;
      vpOpenBookingModal(slotId);
    });
  }

  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) bookingForm.addEventListener('submit', vpHandleBookingSubmit);

  const closeBtn = document.getElementById('booking-close-btn');
  const cancelBtn = document.getElementById('booking-cancel-btn');
  const doneBtn = document.getElementById('booking-done-btn');
  const modal = document.getElementById('booking-modal');

  if (closeBtn) closeBtn.addEventListener('click', vpCloseBookingModal);
  if (cancelBtn) cancelBtn.addEventListener('click', vpCloseBookingModal);
  if (doneBtn) doneBtn.addEventListener('click', vpCloseBookingModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.booking-backdrop')) vpCloseBookingModal();
    });
  }
});
