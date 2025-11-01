
# Vrijeplek.be — Warm v3 (productie-klaar)

Warme, rustige homepage (niet te licht/donker), duidelijke onderverdeling en “Voor bedrijven”-tab. Stripe/Signup/Dashboard/Voorwaarden blijven werken.

## Wat zit erin?
- **Warm UI** (beige/amber), kalme layout, duidelijke secties.
- **Home**: heldere zoekbalk + categorieën + blok “Voor bedrijven”.
- **Voor bedrijven**: info + planselectie (onthoudt plan).
- **Signup**: gegevens + akkoord voorwaarden + naar Stripe Checkout.
- **Login** (Netlify Identity) & **Dashboard** met slots CRUD (Supabase).
- **Algemene voorwaarden** in `terms.html`.
- **Netlify Functions**: `checkout.js`, `webhook.js`, `slots-*`.
- **package.json** met dependencies.
- **netlify.toml** inclusief bundler/headers/redirects.

## ENV variabelen (Netlify → Site settings → Environment)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
STRIPE_PRICE_ACTIVATION=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUCCESS_URL=https://<jouwsite>.netlify.app/login.html?success=1
CANCEL_URL=https://<jouwsite>.netlify.app/signup.html?cancel=1
SMTP_HOST=smtp.<provider>.tld
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Vrijeplek Facturatie <no-reply@vrijeplek.be>"
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...

## Stripe uitbetalingen
- Activeer account (KYC + IBAN) → **Payouts** op Automatic → gebruik LIVE keys.

## Supabase tabel
```sql
create table public.slots (
  id uuid primary key default gen_random_uuid(),
  "when" text not null,
  status text default 'Vrij'
);
alter table public.slots enable row level security;
create policy "public read" on public.slots for select using (true);
create policy "public insert" on public.slots for insert with check (true);
create policy "public delete" on public.slots for delete using (true);
```

## Deploy
1) Repo op GitHub plaatsen (of direct Netlify drag & drop).  
2) Netlify → **Import from Git** → kies repo.  
3) ENV’s invullen → Redeploy.  
4) Identity aanzetten → klaar.
