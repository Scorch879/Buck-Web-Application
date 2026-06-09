# Buck Supabase Auth Setup

This guide covers the Supabase auth configuration Buck expects in Vercel and in the Supabase dashboard.

## 1. Environment Variables

Add these in Vercel under Project Settings > Environment Variables for every environment you deploy:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
```

Then redeploy. Next.js embeds `NEXT_PUBLIC_*` values at build time, so adding them after a deployment will not fix an already-built site.

Local development uses `buck/.env.local`. Keep `MAINTENANCE_MODE=false` when testing auth pages locally.

## 2. Supabase Auth URLs

In Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `https://your-production-domain.com`
- Redirect URLs:
  - `https://your-production-domain.com/**`
  - `https://your-vercel-preview-domain.vercel.app/**`
  - `http://localhost:3000/**`

The app uses:

- Sign up confirmation redirect: `/dashboard/home`
- Password reset redirect: `/forgot-password`
- Magic link redirect: `/dashboard/home`
- Email change redirect: `/dashboard/home`

## 3. SMTP Setup Plan

1. Pick an email provider such as Resend, Postmark, Mailgun, SendGrid, Brevo, or Amazon SES.
2. Verify your sending domain in that provider.
3. Add the provider DNS records:
   - SPF
   - DKIM
   - DMARC
4. Create SMTP credentials in the provider dashboard.
5. In Supabase Dashboard > Authentication > SMTP Settings, enable custom SMTP.
6. Fill in:
   - Sender name: `Buck Budget Tracker`
   - Sender email: `support@your-domain.com`
   - Host, port, username, and password from the provider
   - Use TLS/STARTTLS if your provider supports it
7. Send a test email from Supabase.
8. Deploy Buck with the correct environment variables.

## 4. Email Templates

Use the paste-ready templates in `SUPABASE_EMAIL_TEMPLATES.txt`.

Those templates use inline styles because Supabase email templates are pasted as HTML bodies. No separate `.css` file is needed.

## 5. RLS Policies For Buck Tables

The frontend now validates UUIDs and uses Supabase query builder calls instead of raw SQL. The database still needs Row Level Security enabled so users can only touch their own rows.

Run equivalent policies in Supabase SQL editor if you have not already:

```sql
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.goals enable row level security;
alter table public.expenses enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can upsert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read own wallets"
on public.wallets for select
using (auth.uid() = user_id);

create policy "Users can create own wallets"
on public.wallets for insert
with check (auth.uid() = user_id);

create policy "Users can update own wallets"
on public.wallets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own wallets"
on public.wallets for delete
using (auth.uid() = user_id);

create policy "Users can manage own categories"
on public.categories for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own goals"
on public.goals for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own expenses"
on public.expenses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```
