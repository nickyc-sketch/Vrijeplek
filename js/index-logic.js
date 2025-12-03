// js/index-logic.js

// Kleine helper voor datum naar mooi formaat
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

// We houden de laatste zoekresultaten in geheugen,
// zodat we bij een "Boek"-klik weten over welke slot het gaat.
const vpSearchState = {
  slotsById: {}, // slotId -> slot-object
  profilesByEmail: {}, // email -> profile-object
  currentResults: [],
};

// ---------- ZOEKEN ---------- //

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
  resultsList.innerHTML = '<p>Bezig met zoeken…</p>';
  if (resultsMeta) resultsMeta.textContent = '';
  if (resultsTitle) resultsTitle.textContent = 'Vrije plekken';
  if (bookingMsg) bookingMsg.textContent = '';

  // payload naar jouw Netlify search functie
  const payload = { q, loc, from, to, cat };

  let data;
  try {
    const res = await fetch('/.netlify/functions/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Zoekopdracht mislukt');
    }
  } catch (err) {
    resultsList.innerHTML =
      '<p>Zoeken mislukt. Probeer het later opnieuw.</p>';
    console.error(err);
    return;
  }

  const profiles = data.profiles || [];
  const slots = data.slots || [];

  vpSearchState.slotsById = {};
  vpSearchState.profilesByEmail = {};
  vpSearchState.currentResults = slots;

  profiles.forEach((p) => {
    if (p.email) vpSearchState.profilesByEmail[p.email] = p;
  });
  slots.forEach((s) => {
    const id = s.id || s.slot_id;
    if (id) vpSearchState.slotsById[id] = s;
  });

  if (!slots.length) {
    resultsList.innerHTML =
      '<p>Momenteel geen vrije plekken voor deze zoekopdracht.</p>';
    if (resultsMeta) resultsMeta.textContent = '0 resultaten';
    return;
  }

  // Groeperen per profiel (email)
  const byEmail = {};
  slots.forEach((slot) => {
    const email = slot.email;
    if (!email) return;
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(slot);
  });

  const htmlParts = [];

  Object.keys(byEmail).forEach((email) => {
    const prof = vpSearchState.profilesByEmail[email] || {};
    const companyName =
      prof.company_name || prof.zaak || prof.business_name || 'Onbekende zaak';
    const city =
      prof.business_city || prof.plaats || prof.gemeente || prof.city || '';
    const catLabel = prof.cat_label || prof.category_label || '';

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
          <h3>${companyName}</h3>
          <div class="result-meta">
            ${city ? `<span>${city}</span>` : ''}
            ${catLabel ? `<span>${catLabel}</span>` : ''}
          </div>
        </header>
        <div class="result-slots">
          ${slotsForProfile
            .map((slot) => {
              const id = slot.id || slot.slot_id;
              const date = slot.date || slot.slot_date;
              const fromTime = slot.from || slot.start;
              const toTime = slot.to || slot.end;
              const desc =
                slot.description || slot.desc || 'Vrije plek';
              const places =
                slot.places || slot.places_count || 1;
              const status = (slot.status || '').toLowerCase();
              const isBooked =
                slot.is_booked ||
                slot.booked ||
                status === 'geboekt' ||
                status === 'bezet' ||
                status === 'full' ||
                status === 'closed';

              const badgeText =
                places > 1 ? `${places} plaatsen` : '1 plaats';

              const slotLabelDate = formatDateHuman(date);
              const timeLabel = fromTime && toTime
                ? `${fromTime} – ${toTime}`
                : (fromTime || '');

              // Bepalen of er voorschot is, op basis van slot + profiel
              const slotDepositRequired = !!(
                slot.deposit_required || slot.with_deposit
              );
              const profileDepositEnabled = !!(
                prof.deposit_enabled
              );
              const depositActive =
                slotDepositRequired || profileDepositEnabled;
              const depositAmount =
                slot.deposit_amount ||
                slot.depositAmount ||
                prof.deposit_amount ||
                null;

              const depositSnippet = depositActive
                ? `Voorschot${
                    depositAmount ? ` ca. €${depositAmount}` : ''
                  }`
                : 'Geen voorschot';

              if (!id) return '';

              if (isBooked) {
                // Volzet-slot
                return `
                  <div class="slot-card slot-card-full" data-slot-id="${id}">
                    <div class="slot-main">
                      <div class="slot-title">${slotLabelDate}</div>
                      <div class="slot-time">${timeLabel}</div>
                      <div class="slot-desc">${desc}</div>
                      <div class="slot-meta">
                        <span>${badgeText}</span>
                        <span>Volzet</span>
                      </div>
                    </div>
                    <div class="slot-actions">
                      <span class="slot-badge">Volzet</span>
                    </div>
                  </div>
                `;
              }

              // Open slot met boek-knop
              return `
                <div class="slot-card" data-slot-id="${id}">
                  <div class="slot-main">
                    <div class="slot-title">${slotLabelDate}</div>
                    <div class="slot-time">${timeLabel}</div>
                    <div class="slot-desc">${desc}</div>
                    <div class="slot-meta">
                      <span>${badgeText}</span>
                      <span>${depositSnippet}</span>
                    </div>
                  </div>
                  <div class="slot-actions">
                    <button type="button"
                            class="btn-primary slot-book-btn"
                            data-slot-id="${id}">
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
  if (resultsMeta) {
    resultsMeta.textContent = `${slots.length} open tijdstippen`;
  }
}

// ---------- BOOKING MODAL ---------- //

let vpCurrentSlotId = null;

function vpOpenBookingModal(slotId) {
  const modal = document.getElementById('booking-modal');
  const slotSummaryEl = document.getElementById('booking-slot-summary');
  const depositHint = document.getElementById('booking-deposit-hint');
  const stepForm = document.getElementById('booking-step-form');
  const stepConfirm = document.getElementById('booking-step-confirm');
  const errorEl = document.getElementById('booking-error');

  if (!modal || !slotSummaryEl || !stepForm || !stepConfirm) return;

  const slot = vpSearchState.slotsById[slotId];
  if (!slot) return;

  vpCurrentSlotId = slotId;

  const prof = vpSearchState.profilesByEmail[slot.email] || {};
  const companyName =
    prof.company_name || prof.zaak || 'deze zaak';
  const dateLabel = formatDateHuman(slot.date || slot.slot_date);
  const fromTime = slot.from || slot.start;
  const toTime = slot.to || slot.end;
  const timeLabel = fromTime && toTime
    ? `${fromTime} – ${toTime}`
    : (fromTime || '');
  const desc =
    slot.description || slot.desc || '';

  slotSummaryEl.textContent =
    `${companyName}, ${dateLabel} • ${timeLabel} — ${desc}`;

  // Deposit actief?
  const slotDepositRequired = !!(slot.deposit_required || slot.with_deposit);
  const profileDepositEnabled = !!prof.deposit_enabled;
  const depositActive = slotDepositRequired || profileDepositEnabled;

  if (depositHint) {
    depositHint.style.display = depositActive ? 'block' : 'none';
  }
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }

  // Form-step tonen, confirm-step verbergen
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
  const modal = document.getElementById('booking-modal');
  if (!modal || !vpCurrentSlotId) return;

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

  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }

  const slot = vpSearchState.slotsById[vpCurrentSlotId];
  const prof = slot ? vpSearchState.profilesByEmail[slot.email] || {} : {};

  const payload = {
    slot_id: vpCurrentSlotId,
    name,
    email,
    phone,
    notes,
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Bezig met boeken…';
  }

  let resData;
  try {
    const res = await fetch('/.netlify/functions/book-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    resData = await res.json().catch(() => ({}));
    if (!res.ok || resData.error) {
      throw new Error(
        resData.error ||
          resData.message ||
          'Boeking kon niet worden verwerkt.',
      );
    }
  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent =
        err.message ||
        'Boeking mislukt. Probeer het later opnieuw of contacteer de zaak rechtstreeks.';
      errorEl.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Boeking bevestigen';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Boeking bevestigen';
  }

  // Success → bevestigings-screen
  const stepForm = document.getElementById('booking-step-form');
  const stepConfirm = document.getElementById('booking-step-confirm');
  const confirmText = document.getElementById('booking-confirm-text');
  const depositBlock = document.getElementById('booking-deposit-block');

  if (!stepForm || !stepConfirm || !confirmText) return;

  stepForm.style.display = 'none';
  stepConfirm.style.display = 'block';

  const companyName =
    prof.company_name || prof.zaak || 'deze zaak';
  confirmText.textContent =
    `Je aanvraag is verstuurd naar ${companyName}. ` +
    `Je ontvangt nog een bevestiging van de zaak zelf.`;

  // Deposit info tonen als backend dat terugstuurt
  const depositInfo = resData.deposit || null;
  if (depositInfo && depositBlock) {
    const ibanEl = document.getElementById('deposit-iban');
    const bicEl = document.getElementById('deposit-bic');
    const amtEl = document.getElementById('deposit-amount');
    const msgEl = document.getElementById('deposit-message');
    const textEl = document.getElementById('deposit-text');

    if (ibanEl) ibanEl.textContent = depositInfo.iban || '';
    if (bicEl) bicEl.textContent = depositInfo.bic || '—';
    if (amtEl) amtEl.textContent =
      depositInfo.amount ? `€${depositInfo.amount}` : '';
    if (msgEl) msgEl.textContent = depositInfo.message || '';
    if (textEl) {
      textEl.textContent =
        'Gelieve het voorschot zo snel mogelijk over te schrijven met onderstaande gegevens.';
    }

    depositBlock.style.display = 'block';
  } else if (depositBlock) {
    depositBlock.style.display = 'none';
  }
}

// ---------- INIT ---------- //

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form');
  if (form) {
    form.addEventListener('submit', vpSearchSubmit);
  }

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
  if (bookingForm) {
    bookingForm.addEventListener('submit', vpHandleBookingSubmit);
  }

  const closeBtn = document.getElementById('booking-close-btn');
  const cancelBtn = document.getElementById('booking-cancel-btn');
  const doneBtn = document.getElementById('booking-done-btn');
  const modal = document.getElementById('booking-modal');

  if (closeBtn) closeBtn.addEventListener('click', vpCloseBookingModal);
  if (cancelBtn) cancelBtn.addEventListener('click', vpCloseBookingModal);
  if (doneBtn) doneBtn.addEventListener('click', vpCloseBookingModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.booking-backdrop')) {
        vpCloseBookingModal();
      }
    });
  }
});
