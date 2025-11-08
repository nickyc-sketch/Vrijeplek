import { supa, requireSession } from './auth.js'


const hello = document.getElementById('hello')
const logoutBtn = document.getElementById('logout')
const locBtn = document.getElementById('locatie-btn')
const k1 = document.getElementById('kpi-1'), k2 = document.getElementById('kpi-2'), k3 = document.getElementById('kpi-3'), k4 = document.getElementById('kpi-4')


const monthLabel = document.getElementById('monthLabel')
const calGrid = document.getElementById('calGrid')
const prev = document.getElementById('prev')
const next = document.getElementById('next')
const slotForm = document.getElementById('slotForm')
const slotMsg = document.getElementById('slotMsg')


let session, user
let cursor = new Date()


init()


async function init(){
session = await requireSession(); if(!session) return
user = session.user
const name = user.user_metadata?.voornaam || user.user_metadata?.naam || user.email.split('@')[0]
hello.textContent = `Welkom, ${name}`
renderCalendar()
await refreshKpis()
}


logoutBtn?.addEventListener('click', async()=>{
await supa.auth.signOut(); location.href='/'
})


locBtn?.addEventListener('click', ()=>{
if(!navigator.geolocation){ alert('Locatie niet ondersteund'); return }
navigator.geolocation.getCurrentPosition(
pos=>{ alert(`Locatie: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`) },
err=>{ alert('Kon locatie niet ophalen: '+err.message) }
)
})


prev?.addEventListener('click', ()=>{ cursor.setMonth(cursor.getMonth()-1); renderCalendar() })
next?.addEventListener('click', ()=>{ cursor.setMonth(cursor.getMonth()+1); renderCalendar() })


slotForm?.addEventListener('submit', async (e)=>{
e.preventDefault()
slotMsg.textContent=''
const fd = new FormData(slotForm)
const date = fd.get('date'), start = fd.get('start'), end = fd.get('end'), note = fd.get('note')
if(!date||!start||!end){ slotMsg.textContent='Vul datum en tijd in.'; return }


const { data, error } = await supa.from('calendar_slots').insert({
user_id: user.id, date, start_time:start, end_time:end, note
}).select('*')


if(error){ slotMsg.textContent = 'Bewaren mislukt: '+error.message; return }
slotMsg.textContent = 'Slot toegevoegd.'
renderCalendar()
refreshKpis()
slotForm.reset()
})


async function refreshKpis(){
const ym = cursor.toISOString().slice(0,7)
const first = ym+'-01', last = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0).toISOString().slice(0,10)
const { count } = await supa.from('calendar_slots').select('*', {count:'exact', head:true}).gte('date', first).lte('date', last).eq('user_id', user.id)
k2.textContent = count ?? 0
// placeholders (integreer met je echte tabellen wanneer klaar)
k1.textContent = 0; k3.textContent = 0; k4.textContent = 0
}


async function getSlotsForMonth(yyyy, mm){
const first = new Date(yyyy, mm, 1).toISOString().slice(0,10)
const last = new Date(yyyy, mm+1, 0).toISOString().slice(0,10)
const { data } = await supa.from('calendar_slots')
.select('id,date,start_time,end_time,note')
.gte('date', first).lte('date', last).eq('user_id', user.id)
}
