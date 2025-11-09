import { supa } from './auth.js'

const form = document.getElementById('signup')
const btn  = document.getElementById('do-signup')
const msg  = document.getElementById('msg')
const tos  = document.getElementById('tos')

function fmtBTW(v){ return v.replace(/\s+/g,'').replace(/^be/i,'BE') }
function validBTW(v){
  return /^BE\d{10}$/.test(v.replace(/\D/g,'')) || /^BE\d{3}\.\d{3}\.\d{3}$/.test(v)
}

if (tos) { btn.disabled = !tos.checked; tos.addEventListener('change', ()=> btn.disabled = !tos.checked) }

form?.addEventListener('submit', async (e)=>{
  e.preventDefault()
  msg.textContent = ''

  if(!tos || !tos.checked){ msg.textContent = 'Je moet akkoord gaan met de voorwaarden.'; return }

  const fd = new FormData(form)
  const voornaam = String(fd.get('voornaam')||'').trim()
  const naam     = String(fd.get('naam')||'').trim()
  const btwRaw   = String(fd.get('btw')||'').trim()
  const tel      = String(fd.get('tel')||'').trim()
  const email    = String(fd.get('email')||'').trim()
  const password = String(fd.get('password')||'')
  const bedrijf  = String(fd.get('bedrijf')||'').trim()

  const btw = fmtBTW(btwRaw)
  if(!voornaam||!naam||!tel||!email||!password){ msg.textContent = 'Vul alle verplichte velden in.'; return }
  if(!validBTW(btw)){ msg.textContent = 'BTW-nummer lijkt ongeldig. Gebruik BE0123456789.'; return }

  btn.disabled = true; btn.textContent = 'Verwerken…'

  const redirectTo = `${location.origin}/geactiveerd.html`
  const { error } = await supa.auth.signUp({
    email, password,
    options:{ emailRedirectTo: redirectTo, data:{ voornaam, naam, btw, tel, bedrijf, tos:true } }
  })

  if(error){
    msg.textContent = 'Aanmelden mislukt: ' + error.message
    btn.disabled = false; btn.textContent = 'Account aanmaken'
    return
  }

  msg.textContent = 'Bevestigingsmail verstuurd. Je wordt doorverwezen…'
  setTimeout(()=>{ window.location.href = '/bevestigen.html' }, 600)
})
