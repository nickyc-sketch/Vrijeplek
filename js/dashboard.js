<script>
    console.log('Dashboard script loading...');

    const urlParams = new URLSearchParams(window.location.search);
    let dashboardEmail = urlParams.get('email') ? decodeURIComponent(urlParams.get('email')) : null;

    if (!dashboardEmail) {
      const stored = localStorage.getItem('vp_email');
      if (stored) dashboardEmail = stored;
    }
    if (dashboardEmail) localStorage.setItem('vp_email', dashboardEmail);

    const API_SLOTS    = '/.netlify/functions/slots';
    const API_PROFILE  = '/.netlify/functions/profile';
    const API_FLEXJOBS = '/.netlify/functions/flexijobs';

    window.vpProfileReady = window.vpProfileReady || false;

    function formatDateKey(date){
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

    function showToast(message, type = 'success'){
      const toast = document.getElementById('vp-toast');
      if(!toast) return;
      const icon = toast.querySelector('.toast-icon');
      const text = toast.querySelector('.toast-text');

      text.textContent = message;
      toast.classList.remove('toast-success','toast-error','is-visible');
      toast.style.display = 'flex';

      if(type === 'error'){
        toast.classList.add('toast-error');
        if(icon) icon.textContent = '!';
      }else{
        toast.classList.add('toast-success');
        if(icon) icon.textContent = '✓';
      }

      requestAnimationFrame(() => toast.classList.add('is-visible'));
      setTimeout(() => toast.classList.remove('is-visible'), 3200);
    }

    // ---------------------------
    // SLOTS API
    // ---------------------------
    async function fetchSlotsForDate(dateKey){
      const url = new URL(API_SLOTS, window.location.origin);
      url.searchParams.set('date', dateKey);
      if (dashboardEmail) url.searchParams.set('email', dashboardEmail);

      const res = await fetch(url.toString(), { method:'GET', credentials:'include' });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Kon de tijdstippen niet laden.'));
      return res.json();
    }

    async function fetchAppointmentsRange(fromKey, toKey){
  if (!dashboardEmail) return { booked: [], open: [] };

  const url = new URL(API_SLOTS, window.location.origin);
  url.searchParams.set('email', dashboardEmail);
  url.searchParams.set('from', fromKey);
  url.searchParams.set('to', toKey);
  url.searchParams.set('split', '1'); // ✅ 1 call

  const res = await fetch(url.toString(), { method:'GET', credentials:'include' });
  if (!res.ok) throw new Error(await res.text().catch(() => 'Kon afspraken niet laden.'));

  const data = await res.json().catch(() => ({ booked: [], open: [] }));
  return {
    booked: Array.isArray(data.booked) ? data.booked : [],
    open: Array.isArray(data.open) ? data.open : []
  };
}

    async function createSlot(payload){
      const res = await fetch(API_SLOTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorData;
        try { errorData = await res.json(); }
        catch { errorData = { error: await res.text() }; }
        throw new Error(errorData.error || errorData.details || 'Tijdslot kon niet worden opgeslagen');
      }
      return res.json();
    }

    async function updateSlot(payload){
      const res = await fetch(API_SLOTS, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        credentials:'include',
        body:JSON.stringify(payload)
      });
      if(!res.ok) throw new Error(await res.text());
      return res.json();
    }

    async function deleteSlot(id){
      const url = new URL(API_SLOTS, window.location.origin);
      url.searchParams.set('id', id);
      const res = await fetch(url.toString(), { method:'DELETE', credentials:'include' });
      if(!res.ok) throw new Error(await res.text());
      try { return await res.json(); } catch { return null; }
    }

    // ---------------------------
    // Render helpers
    // ---------------------------
    function isBookedSlot(item){
  const st = String(item.status || '').toLowerCase();
  return st === 'booked' || st === 'pending_deposit';
}

    function renderSlotList(slotArray, slotListEl, slotEmptyEl){
      if(!slotListEl || !slotEmptyEl) return;
      if(!slotArray || !slotArray.length){
        slotListEl.innerHTML = '';
        slotListEl.style.display = 'none';
        slotEmptyEl.style.display = 'block';
        return;
      }

      slotEmptyEl.style.display = 'none';
      slotListEl.style.display = 'block';

      const uniqueSlots = [];
      const seenKeys = new Set();
      slotArray.forEach(item => {
        const startKey = item.start || item.start_time || '';
        const endKey   = item.end   || item.end_time   || '';
        const descKey  = item.description || item.desc || '';
        const key = `${startKey}|${endKey}|${descKey}`;
        if (!seenKeys.has(key)) { seenKeys.add(key); uniqueSlots.push(item); }
      });

      const rows = uniqueSlots.map(item => {
        const start = item.start || item.start_time || '';
        const end   = item.end   || item.end_time   || '';
        const desc  = item.description || item.desc || 'Geen omschrijving';
        const booked = isBookedSlot(item);
        const bookedLabel = booked ? 'Geboekt • niet meer wijzigbaar' : 'Open tijdstip';
        const editDisabled = booked ? 'disabled aria-disabled="true"' : '';
        const idAttr = item.id || item.slot_id || '';

        return `
          <div class="slot-item ${booked ? 'is-booked' : ''}" data-slot-id="${idAttr}">
            <div class="slot-item-header">
              <div>
                <div class="slot-item-title">${start} – ${end}</div>
                <div class="slot-item-desc">${desc}</div>
                <div class="slot-meta">${bookedLabel}</div>
              </div>
            </div>
            <div class="slot-actions">
              <button type="button" class="btn-ghost btn-small" data-slot-edit="${idAttr}" ${editDisabled}>Aanpassen</button>
              <button type="button" class="btn-ghost btn-small btn-danger" data-slot-delete="${idAttr}" ${editDisabled}>Verwijderen</button>
            </div>
          </div>
        `;
      });

      slotListEl.innerHTML = rows.join('');
    }

    function renderAppointments(data){
      const emptyWrap = document.getElementById('appointments-empty');
      const gridWrap  = document.getElementById('appointments-grid');

      const bookedEmpty = document.getElementById('booked-empty');
      const openEmpty   = document.getElementById('open-empty');

      const bookedList  = document.getElementById('booked-list');
      const openList    = document.getElementById('open-list');

      const booked = (data && Array.isArray(data.booked)) ? data.booked : [];
      const open   = (data && Array.isArray(data.open)) ? data.open : [];

      const hasAnything = booked.length || open.length;

      if (!hasAnything){
        if (emptyWrap) emptyWrap.style.display = 'block';
        if (gridWrap) gridWrap.style.display = 'none';
        if (bookedList) bookedList.innerHTML = '';
        if (openList) openList.innerHTML = '';
        return;
      }

      if (emptyWrap) emptyWrap.style.display = 'none';
      if (gridWrap) gridWrap.style.display = 'grid';

      // booked
      if (bookedEmpty) bookedEmpty.style.display = booked.length ? 'none' : 'block';
      if (bookedList){
        bookedList.innerHTML = booked.map(item => {
          const date = item.date || '';
          const start = item.start || '';
          const end = item.end || '';
          const desc = item.description || 'Afspraak';
          const st = String(item.status || '').toLowerCase();
          const badge = (st === 'pending_deposit')
            ? `<span class="btn-pill btn-small">Wacht op voorschot</span>`
            : `<span class="btn-pill btn-small">Geboekt</span>`;

          return `
            <div class="slot-item is-booked" style="margin-bottom:.75rem;">
              <div class="slot-item-header">
                <div>
                  <div class="slot-item-title">${date} • ${start} – ${end}</div>
                  <div class="slot-item-desc">${desc}</div>
                  <div class="slot-meta">${badge}</div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      // open
      openList.innerHTML = open.map(item => {
  const id = item.id || item.slot_id || '';
  const date = item.date || '';
  const start = item.start || '';
  const end = item.end || '';
  const desc = item.description || 'Open tijdstip';

  return `
    <div class="slot-item" style="margin-bottom:.75rem;" data-appt-id="${id}">
      <div class="slot-item-header">
        <div>
          <div class="slot-item-title">${date} • ${start} – ${end}</div>
          <div class="slot-item-desc">${desc}</div>
          <div class="slot-meta">Open</div>
        </div>
      </div>

      <div class="slot-actions">
        <button type="button" class="btn-ghost btn-small" data-appt-edit="${id}">Aanpassen</button>
        <button type="button" class="btn-ghost btn-small btn-danger" data-appt-delete="${id}">Verwijderen</button>
      </div>
    </div>
  `;
}).join('');

wireAppointmentsActions(open); // ✅ voeg dit toe
      }
    
function wireAppointmentsActions(openArray){
  const openList = document.getElementById('open-list');
  if (!openList) return;

  openList.querySelectorAll('[data-appt-edit]').forEach(btn => {
    const id = btn.getAttribute('data-appt-edit');
    const slot = (openArray || []).find(s => String(s.id || s.slot_id) === String(id));
    if (!slot) return;

    btn.onclick = () => {
      if (window.vpOpenSlotFromAppointments) {
        window.vpOpenSlotFromAppointments(slot); // ✅ springt naar "tijden" en vult formulier
      } else {
        showToast('Edit-functie is nog niet geïnitialiseerd.', 'error');
      }
    };
  });

  openList.querySelectorAll('[data-appt-delete]').forEach(btn => {
    const id = btn.getAttribute('data-appt-delete');
    const slot = (openArray || []).find(s => String(s.id || s.slot_id) === String(id));
    if (!slot) return;

    btn.onclick = async () => {
      const ok = confirm('Weet je zeker dat je dit tijdslot wil verwijderen?');
      if (!ok) return;

      try{
        await deleteSlot(id);
        showToast('Tijdslot verwijderd','success');
        await loadAppointments();
      }catch(err){
        console.error(err);
        showToast('Verwijderen mislukt: ' + (err.message || err),'error');
      }
    };
  });
}

    async function loadAppointments(){
      try{
        const from = new Date(); from.setHours(0,0,0,0);
        const to = new Date(from.getTime());
        to.setDate(to.getDate() + 60);

        const data = await fetchAppointmentsRange(formatDateKey(from), formatDateKey(to));
        renderAppointments(data);
      }catch(err){
        console.error(err);
        showToast('Kon afspraken niet laden: ' + (err.message || err), 'error');
      }
    }

    // ---------------------------
    // PROFILE
    // ---------------------------
    async function fetchProfile(){
      if (!dashboardEmail) return null;
      const url = new URL(API_PROFILE, window.location.origin);
      url.searchParams.set('email', dashboardEmail);

      const res = await fetch(url.toString(), { method:'GET', credentials:'include' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    async function saveProfile(payload){
      if (!dashboardEmail) throw new Error('Geen e-mailadres gevonden');

      const res = await fetch(API_PROFILE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: dashboardEmail, ...payload })
      });

      if (!res.ok) {
        let errorData;
        try { errorData = await res.json(); }
        catch { errorData = { error: await res.text() }; }

        throw new Error(errorData.details || errorData.error || 'Failed to save profile');
      }

      return res.json();
    }

    function getDepositAmountFromUI(){
      const sel = document.getElementById('deposit-amount-select');
      const custom = document.getElementById('deposit-amount-custom');

      const v = (sel?.value || '').trim();
      if (!v) return 0;

      if (v === 'custom') {
        const n = Number((custom?.value || '').trim());
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.floor(n);
      }

      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.floor(n);
    }

    function computeProfileReadyFromDom(){
      const requiredIds = [
        'company-name','contact-name','billing-email','phone','vat-number',
        'business-street','business-postcode','business-city'
      ];

      for(const id of requiredIds){
        const el = document.getElementById(id);
        if(!el || !el.value || !el.value.trim()) return false;
      }

      const depositToggle = document.getElementById('deposit-enabled');
      if (depositToggle && depositToggle.checked) {
        const iban = document.getElementById('iban');
        if (!iban || !iban.value.trim()) return false;

        // ✅ deposit mag leeg zijn → dus GEEN verplichting hier
        // Als hij wél ingevuld wordt, moet het > 0 zijn:
        const sel = document.getElementById('deposit-amount-select');
        const custom = document.getElementById('deposit-amount-custom');

        const v = (sel?.value || '').trim();
        if (v && v !== 'custom') {
          if (Number(v) <= 0) return false;
        }
        if (v === 'custom') {
          const cv = (custom?.value || '').trim();
          if (cv && Number(cv) <= 0) return false;
        }
      }

      return true;
    }

    function updateFeatureLockUI(){
      window.vpProfileReady = !!computeProfileReadyFromDom();

      const flexTab = document.querySelector('.dash-tab[data-panel="flexijobs"]');
      if (!flexTab) return;

      if(window.vpProfileReady){
        flexTab.classList.remove('is-locked');
        flexTab.removeAttribute('title');
      }else{
        flexTab.classList.add('is-locked');
        flexTab.setAttribute('title','Vul eerst je bedrijfs- en locatiegegevens in bij Instellingen.');
      }
    }

    function applyProfileToForm(profile){
      if(!profile) { updateFeatureLockUI(); return; }
      const byId = (id) => document.getElementById(id);

      if(byId('company-name'))  byId('company-name').value  = profile.company_name || profile.zaak || '';
      if(byId('contact-name'))  byId('contact-name').value  = profile.contact_name || '';
      if(byId('billing-email')) byId('billing-email').value = profile.billing_email || '';
      if(byId('phone'))         byId('phone').value         = profile.phone || profile.telefoon || '';
      if(byId('vat-number'))    byId('vat-number').value    = profile.vat_number || profile.btw || '';
      if(byId('invoice-note'))  byId('invoice-note').value  = profile.invoice_note || '';
      if(byId('iban'))          byId('iban').value          = profile.iban || '';
      if(byId('bic'))           byId('bic').value           = profile.bic || '';
      if(byId('extra-footer'))  byId('extra-footer').value  = profile.extra_footer || '';

      if(byId('business-street'))   byId('business-street').value   = profile.business_street || profile.straat || '';
      if(byId('business-postcode')) byId('business-postcode').value = profile.business_postcode || profile.postcode || '';
      if(byId('business-city'))     byId('business-city').value     = profile.business_city || profile.plaats || profile.gemeente || '';

      const depositEnabledInput = document.getElementById('deposit-enabled');
      if(depositEnabledInput){
        depositEnabledInput.checked = !!profile.deposit_enabled;
        depositEnabledInput.dispatchEvent(new Event('change'));
      }

      // ✅ deposit amount -> select/custom UI
      const depSelect = document.getElementById('deposit-amount-select');
      const depCustom = document.getElementById('deposit-amount-custom');
      const depWrap   = document.getElementById('deposit-amount-custom-wrap');
      const depVal = Number(profile.deposit_amount ?? 0);

      if (depSelect) {
        if (!depVal || depVal === 0) {
          depSelect.value = '';
          if (depWrap) depWrap.style.display = 'none';
          if (depCustom) depCustom.value = '';
        } else if (['15','25','50'].includes(String(depVal))) {
          depSelect.value = String(depVal);
          if (depWrap) depWrap.style.display = 'none';
          if (depCustom) depCustom.value = '';
        } else {
          depSelect.value = 'custom';
          if (depWrap) depWrap.style.display = 'flex';
          if (depCustom) depCustom.value = String(depVal);
        }
      }

      const googleReviewEnabledInput = document.getElementById('google-review-enabled');
      if(googleReviewEnabledInput) {
        googleReviewEnabledInput.checked = !!profile.google_review_enabled;
        googleReviewEnabledInput.dispatchEvent(new Event('change'));
      }
      if(byId('google-review-url')) byId('google-review-url').value = profile.google_review_url || '';

      const shareLocationEnabledInput = document.getElementById('share-location-enabled');
      if(shareLocationEnabledInput) shareLocationEnabledInput.checked = !!profile.share_location_enabled;

      const status = document.getElementById('settings-status');
      if(status){
        status.textContent = 'Instellingen opgeslagen';
        status.style.background = 'rgba(22,163,74,.18)';
        status.style.borderColor = 'rgba(34,197,94,.7)';
        status.style.color = '#bbf7d0';
      }

      // autofill flex
      const flexContactName = document.getElementById('flex-contact-name');
      if (flexContactName && !flexContactName.value) flexContactName.value = profile.contact_name || '';
      const flexContactEmail = document.getElementById('flex-contact-email');
      if (flexContactEmail && !flexContactEmail.value) flexContactEmail.value = profile.billing_email || dashboardEmail || '';
      const flexContactPhone = document.getElementById('flex-contact-phone');
      if (flexContactPhone && !flexContactPhone.value) flexContactPhone.value = profile.phone || '';

      updateFeatureLockUI();
    }

    function collectSettingsPayload(){
      const getVal = (id) => (document.getElementById(id)?.value || '').trim();
      const getChecked = (id) => !!document.getElementById(id)?.checked;

      const deposit_enabled = getChecked('deposit-enabled');
      const deposit_amount = getDepositAmountFromUI(); // ✅ altijd number, nooit null

      return {
        company_name: getVal('company-name'),
        contact_name: getVal('contact-name'),
        billing_email: getVal('billing-email'),
        phone: getVal('phone'),
        vat_number: getVal('vat-number'),
        invoice_note: getVal('invoice-note'),
        deposit_enabled,
        iban: getVal('iban'),
        bic: getVal('bic'),
        deposit_amount: deposit_enabled ? deposit_amount : 0, // ✅ DB-safe
        extra_footer: getVal('extra-footer'),
        google_review_enabled: getChecked('google-review-enabled'),
        google_review_url: getVal('google-review-url'),
        share_location_enabled: getChecked('share-location-enabled'),
        business_street: getVal('business-street'),
        business_postcode: getVal('business-postcode'),
        business_city: getVal('business-city'),
      };
    }

    // ---------------------------
    // Tabs
    // ---------------------------
    function handleTabClick(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      const tab = e ? e.currentTarget : this;
      const target = tab.getAttribute('data-panel');
      if (!target) return;

      if (target === 'flexijobs' && !window.vpProfileReady) {
        showToast('Vul eerst je bedrijfs- en locatiegegevens in bij Instellingen.','error');
        document.querySelector('.dash-tab[data-panel="instellingen"]')?.click();
        return false;
      }

      document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      document.querySelectorAll('.dash-panel').forEach(panel => {
        panel.classList.toggle('is-visible', panel.id === `panel-${target}`);
      });

      if (target === 'afspraken') loadAppointments();

      return false;
    }

    document.addEventListener('click', function(e) {
      const tab = e.target.closest('.dash-tab');
      if (tab && !tab.hasAttribute('data-handled')) {
        tab.setAttribute('data-handled', 'true');
        handleTabClick.call(tab, e);
        setTimeout(() => tab.removeAttribute('data-handled'), 100);
      }
    }, false);

    // ---------------------------
    // Init dashboard
    // ---------------------------
    function initDashboard() {
      const yearSpan = document.getElementById('year-span');
      if(yearSpan) yearSpan.textContent = new Date().getFullYear();

      document.querySelectorAll('.dash-tab').forEach(tab => tab.addEventListener('click', handleTabClick));

      document.querySelectorAll('[data-panel-jump="tijden"]').forEach(btn => {
        btn.onclick = function(e) {
          e.preventDefault(); e.stopPropagation();
          document.querySelector('.dash-tab[data-panel="tijden"]')?.click();
        };
      });

      // deposit block enable/disable + custom ui
      const depositToggle = document.getElementById('deposit-enabled');
      const depositBlock = document.querySelector('[data-deposit-block]');
      const depSelect = document.getElementById('deposit-amount-select');
      const depWrap = document.getElementById('deposit-amount-custom-wrap');
      const depCustom = document.getElementById('deposit-amount-custom');

      const updateDepositState = () => {
        if (depositToggle && depositBlock) {
          depositBlock.classList.toggle('is-disabled', !depositToggle.checked);
        }
        updateFeatureLockUI();
      };

      if (depositToggle) {
        depositToggle.addEventListener('change', updateDepositState);
      }
      updateDepositState();

      if (depSelect) {
        const onDepSelectChange = () => {
          const v = depSelect.value;
          if (v === 'custom') {
            if (depWrap) depWrap.style.display = 'flex';
          } else {
            if (depWrap) depWrap.style.display = 'none';
            if (depCustom) depCustom.value = '';
          }
          updateFeatureLockUI();
        };
        depSelect.addEventListener('change', onDepSelectChange);
        onDepSelectChange();
      }
      if (depCustom) {
        depCustom.addEventListener('input', () => updateFeatureLockUI());
      }

      // google review field
      const googleReviewToggle = document.getElementById('google-review-enabled');
      const googleReviewField = document.getElementById('google-review-field');
      if (googleReviewToggle && googleReviewField) {
        const updateGoogleReviewVisibility = () => {
          googleReviewField.style.display = googleReviewToggle.checked ? 'block' : 'none';
        };
        googleReviewToggle.addEventListener('change', updateGoogleReviewVisibility);
        updateGoogleReviewVisibility();
      }

      // Calendar + slots
      const slotForm   = document.getElementById('slot-form');
      const slotList   = document.getElementById('slot-list');
      const slotEmpty  = document.getElementById('slot-empty');
      const slotStart  = document.getElementById('slot-start');
      const slotEnd    = document.getElementById('slot-end');
      const slotPlaces = document.getElementById('slot-places');
      const slotDesc   = document.getElementById('slot-desc');
      const slotVisible= document.getElementById('slot-visible');
      const slotSubmitBtn = document.getElementById('slot-submit-btn');

      const grid = document.querySelector('[data-cal-grid]');
      const monthLabel = document.querySelector('[data-cal-month]');
      const yearLabel = document.querySelector('[data-cal-year]');
      const selectedLabel = document.querySelector('[data-selected-date]');
      const selectedShort = document.querySelector('[data-selected-date-short]');

      let current = new Date(); current.setDate(1);
      let selected = new Date(); selected.setHours(0,0,0,0);

      const slotsCache = {};
      let editingSlotId = null;
      window.vpOpenSlotFromAppointments = async function(slot){
  // 1) ga naar tab "tijden"
  document.querySelector('.dash-tab[data-panel="tijden"]')?.click();

  // 2) selecteer datum in kalender
  const dateStr = slot.date || slot.dateKey || '';
  if (!dateStr) {
    showToast('Geen datum gevonden voor dit tijdslot.', 'error');
    return;
  }

  const targetDate = new Date(dateStr);
  targetDate.setHours(0,0,0,0);

  // current maand naar juiste maand zetten
  current = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  selected = new Date(targetDate);

  updateSelectedLabels();
  renderCalendar();

  // 3) laad slots van die dag (vult cache + rendert lijst)
  await loadSlotsForSelectedDate();

  // 4) zet edit state + vul form
  editingSlotId = String(slot.id || slot.slot_id || '');
  slotStart.value = slot.start || '';
  slotEnd.value = slot.end || '';
  if (slotPlaces) slotPlaces.value = 1; // optioneel (je bewaart dit niet in payload)
  slotDesc.value = slot.description || '';
  if (slotVisible) slotVisible.checked = true;

  if (slotSubmitBtn) slotSubmitBtn.textContent = 'Tijdslot bijwerken';
  showToast('Tijdslot geladen om aan te passen','success');
  slotForm.scrollIntoView({behavior:'smooth', block:'start'});
};
      const monthNames = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
      const weekdayNames = ['maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag','zondag'];

      function updateSelectedLabels(){
        const d = selected.getDate();
        const m = selected.getMonth();
        const weekdayIndex = (selected.getDay() + 6) % 7;
        let long = `${weekdayNames[weekdayIndex]} ${d} ${monthNames[m]}`;
        long = long.charAt(0).toUpperCase() + long.slice(1);
        if(selectedLabel) selectedLabel.textContent = long;
        if(selectedShort) selectedShort.textContent = selected.toLocaleDateString('nl-BE', { day:'2-digit', month:'2-digit', year:'numeric' });
      }

      function wireSlotButtonsForDate(dateKey){
        if(!slotList) return;
        const slotArray = slotsCache[dateKey] || [];

        slotList.querySelectorAll('[data-slot-edit]').forEach(btn => {
          const id = btn.getAttribute('data-slot-edit');
          const slot = slotArray.find(s => String(s.id || s.slot_id) === String(id));
          if(!slot) return;

          btn.addEventListener('click', () => {
            if (isBookedSlot(slot)) return;

            editingSlotId = id;
            slotStart.value  = slot.start || '';
            slotEnd.value    = slot.end || '';
            if (slotPlaces) slotPlaces.value = 1;
            slotDesc.value   = slot.description || '';
            if(slotVisible) slotVisible.checked = true;

            if(slotSubmitBtn) slotSubmitBtn.textContent = 'Tijdslot bijwerken';
            showToast('Tijdslot geladen om aan te passen','success');
            slotForm.scrollIntoView({behavior:'smooth', block:'start'});
          });
        });

        slotList.querySelectorAll('[data-slot-delete]').forEach(btn => {
          const id = btn.getAttribute('data-slot-delete');
          const slot = slotArray.find(s => String(s.id || s.slot_id) === String(id));
          if(!slot) return;

          btn.addEventListener('click', async () => {
            if(btn.disabled) return;
            if (isBookedSlot(slot)) return;

            const ok = confirm('Weet je zeker dat je dit tijdslot wil verwijderen?');
            if(!ok) return;

            try{
              await deleteSlot(id);
              showToast('Tijdslot verwijderd','success');
              await loadSlotsForSelectedDate();
              await loadAppointments();
            }catch(err){
              console.error(err);
              showToast('Verwijderen mislukt: ' + (err.message || err),'error');
            }
          });
        });
      }

      async function loadSlotsForSelectedDate(){
        if(!grid || !selected) return;
        const key = formatDateKey(selected);

        try{
          const data = await fetchSlotsForDate(key);
          slotsCache[key] = data || [];
          renderSlotList(slotsCache[key], slotList, slotEmpty);
          wireSlotButtonsForDate(key);
        }catch(err){
          console.error(err);
          showToast('Kon de tijdstippen niet laden: ' + (err.message || err),'error');
        }
      }

      function renderCalendar(){
        if(!grid) return;
        const year = current.getFullYear();
        const month = current.getMonth();

        if(monthLabel) monthLabel.textContent = monthNames[month][0].toUpperCase() + monthNames[month].slice(1);
        if(yearLabel) yearLabel.textContent = year;

        grid.innerHTML = '';
        const firstDay = new Date(year, month, 1);
        const startWeekday = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const today = new Date(); today.setHours(0,0,0,0);

        for (let i = 0; i < startWeekday; i++) grid.appendChild(document.createElement('div'));

        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          date.setHours(0,0,0,0);

          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'calendar-day';
          cell.textContent = d;

          if (date.getTime() === today.getTime()) cell.classList.add('is-today');
          if (date.getTime() === selected.getTime()) cell.classList.add('is-selected');

          cell.addEventListener('click', async () => {
            selected = date;
            updateSelectedLabels();
            renderCalendar();
            await loadSlotsForSelectedDate();
          });

          grid.appendChild(cell);
        }
      }

      document.querySelector('[data-cal-prev]')?.addEventListener('click', () => { current.setMonth(current.getMonth() - 1); renderCalendar(); });
      document.querySelector('[data-cal-next]')?.addEventListener('click', () => { current.setMonth(current.getMonth() + 1); renderCalendar(); });
      document.querySelector('[data-cal-today]')?.addEventListener('click', async () => {
        current = new Date(); current.setDate(1);
        selected = new Date(); selected.setHours(0,0,0,0);
        updateSelectedLabels();
        renderCalendar();
        await loadSlotsForSelectedDate();
      });

      if(slotForm){
        slotForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const startVal  = slotStart.value;
          const endVal    = slotEnd.value;
          const descVal   = slotDesc.value.trim();

          if(!startVal || !endVal){
            showToast('Vul minstens een start- en einduur in.','error');
            return;
          }

          const dateKey = formatDateKey(selected);

          const payloadBase = {
            date: dateKey,
            start: startVal,
            end: endVal,
            description: descVal
          };

          if(dashboardEmail) payloadBase.email = dashboardEmail;

          try{
            if(editingSlotId){
              await updateSlot({ ...payloadBase, id: editingSlotId });
            }else{
              await createSlot(payloadBase);
            }

            slotForm.reset();
            if(slotVisible) slotVisible.checked = true;
            if(slotSubmitBtn) slotSubmitBtn.textContent = '＋ Tijdslot opslaan';

            const msg = editingSlotId ? 'Tijdslot bijgewerkt' : 'Tijdslot opgeslagen';
            editingSlotId = null;

            showToast(msg,'success');
            await loadSlotsForSelectedDate();
            await loadAppointments();
          }catch(err){
            console.error(err);
            showToast('Tijdslot kon niet worden opgeslagen: ' + (err.message || err),'error');
          }
        });
      }

      // Settings submit + load profile
      const settingsForm = document.getElementById('settings-form');
      if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          if (!dashboardEmail) {
            showToast('Geen e-mailadres gevonden. Log opnieuw in via je Vrijeplek-link.','error');
            return;
          }

          const payload = collectSettingsPayload();

          try {
            await saveProfile(payload);
            const status = document.getElementById('settings-status');
            if (status) {
              status.textContent = 'Instellingen opgeslagen';
              status.style.background = 'rgba(22,163,74,.18)';
              status.style.borderColor = 'rgba(34,197,94,.7)';
              status.style.color = '#bbf7d0';
            }
            updateFeatureLockUI();
            showToast('Instellingen opgeslagen.','success');
          } catch (err) {
            console.error(err);
            showToast('Instellingen opslaan mislukt: ' + (err.message || err),'error');
          }
        });

        (async () => {
          try { applyProfileToForm(await fetchProfile()); }
          catch (err) { console.error(err); }
        })();
      }

      // Flexjob submit
      const flexForm = document.getElementById('flexjob-form');
      const flexStatus = document.getElementById('flexjob-status');

      if (flexForm) {
        const flexTitleEl = document.getElementById('flex-title');
        const flexSectorEl = document.getElementById('flex-sector');
        const flexLocEl = document.getElementById('flex-location');
        const flexHoursEl = document.getElementById('flex-hours');
        const flexPayEl = document.getElementById('flex-pay');
        const flexContactNameEl = document.getElementById('flex-contact-name');
        const flexContactEmailEl = document.getElementById('flex-contact-email');
        const flexContactPhoneEl = document.getElementById('flex-contact-phone');
        const flexDescEl = document.getElementById('flex-description');

        flexForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          if (!window.vpProfileReady) {
            showToast('Vul eerst je bedrijfs- en locatiegegevens in bij Instellingen.','error');
            document.querySelector('.dash-tab[data-panel="instellingen"]')?.click();
            return;
          }

          const title = flexTitleEl.value.trim();
          const description = flexDescEl.value.trim();

          if (!title || !description) {
            showToast('Vul minstens een titel en omschrijving in voor je vacature.','error');
            return;
          }

          const payload = {
            title,
            sector: flexSectorEl.value.trim() || '',
            location: flexLocEl.value.trim() || '',
            hours: flexHoursEl.value.trim() || '',
            pay: flexPayEl.value.trim() || '',
            contact_name: flexContactNameEl.value.trim() || '',
            contact_email: flexContactEmailEl.value.trim() || '',
            contact_phone: flexContactPhoneEl.value.trim() || '',
            description,
            owner_email: dashboardEmail || ''
          };

          try {
            if (flexStatus) flexStatus.textContent = 'Bezig met opslaan…';
            const res = await fetch(API_FLEXJOBS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || (data && data.error)) {
              const msg = data && data.error ? data.error : 'Vacature kon niet worden opgeslagen.';
              showToast(msg,'error');
              if (flexStatus) flexStatus.textContent = msg;
              return;
            }

            showToast('Vacature opgeslagen en doorgestuurd naar de homepage.','success');
            if (flexStatus) flexStatus.textContent = 'Vacature gepubliceerd.';
            flexForm.reset();
          } catch (err) {
            console.error(err);
            const msg = 'Opslaan van vacature mislukt.';
            showToast(msg,'error');
            if (flexStatus) flexStatus.textContent = msg;
          }
        });
      }

      // Logout
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn){
        logoutBtn.onclick = function(e) {
          e.preventDefault(); e.stopPropagation();
          window.location.href = '/logout.html';
        };
      }

      // ✅ init calls
      renderCalendar();
      updateSelectedLabels();
      loadSlotsForSelectedDate();
      updateFeatureLockUI();
      loadAppointments();
    }

    document.addEventListener('DOMContentLoaded', function() {
      try { initDashboard(); }
      catch (err) { console.error('Init error:', err); }
    });

    // keyboard shortcuts
    window.switchTab = function(panelName) {
  const tab = document.querySelector(`.dash-tab[data-panel="${panelName}"]`);
  if (tab) tab.click();
};

    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { e.preventDefault(); window.switchTab('afspraken'); }
        if (e.key === '2') { e.preventDefault(); window.switchTab('tijden'); }
        if (e.key === '3') { e.preventDefault(); window.switchTab('website'); }
        if (e.key === '4') { e.preventDefault(); window.switchTab('flexijobs'); }
        if (e.key === '5') { e.preventDefault(); window.switchTab('instellingen'); }
      }
    });
  </script>
