import { supa } from './auth.js'

const form = document.getElementById('login')
const btn  = document.getElementById('do-login')
const msg  = document.getElementById('msg')

form?.addEventListener('submit', async (e)=>{
  e.preventDefault()
  msg.textContent = ''
  btn.disabled = true; btn.textContent = 'Inloggen…'

  const fd = new FormData(form)
  const email = String(fd.get('email')||'').trim()
  const password = String(fd.get('password')||'')

  const { error } = await supa.auth.signInWithPassword({ email, password })

  if (error) {
    msg.textContent = 'Inloggen mislukt: ' + error.message
    btn.disabled = false; btn.textContent = 'Inloggen'
    return
  }
  window.location.href = '/dashboard.html'
})
