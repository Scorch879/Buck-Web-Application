-- Reseed for cash-flow + income testing (NOT a migration; run manually). Supersedes seed_varied_test_data.sql.
-- 1) Deletes ALL earlier seed data: every expense (all were seed: metadata.seed tag, source 'monthly_seed',
--    or 'Auto-generated test record' notes), all AI forecasts/advisories (derived caches), the 'Seed Bank
--    Account' wallets, and the seeded goals. User-made data (e.g. archived wallets, the user's own goal) stays.
-- 2) Inserts May-Oct 2026 expenses + incomes per user in 8 spending/income personas, scaled so each
--    month's spend hits a target share of income (some months net-negative), then rebuilds wallet balances
--    as opening + incomes - expenses, then goals, forecasts and advisories.
-- Tag: metadata->>'seed' = 'cashflow-2026-10-12' (expenses, incomes, forecasts, advisories).
-- UNDO of this seed:
--   delete from public.ai_advisories where metadata->>'seed' = 'cashflow-2026-10-12';
--   delete from public.ai_forecasts  where metadata->>'seed' = 'cashflow-2026-10-12';
--   delete from public.incomes       where metadata->>'seed' = 'cashflow-2026-10-12';
--   delete from public.expenses      where metadata->>'seed' = 'cashflow-2026-10-12';

-- ---- 1. Delete old seed data ----
delete from public.ai_advisories;
delete from public.ai_forecasts;
delete from public.incomes where metadata->>'seed' is not null;
delete from public.expenses
where metadata->>'seed' is not null
   or metadata->>'source' = 'monthly_seed'
   or metadata->>'note' like 'Auto-generated test record%';

update public.goals set current_amount = 0, is_active = false
where goal_name like 'Seed: %'
   or goal_name in ('Emergency Buffer (3 Months)', 'Ergonomic Workstation Setup');
delete from public.goals
where goal_name like 'Seed: %'
   or goal_name in ('Emergency Buffer (3 Months)', 'Ergonomic Workstation Setup');

update public.profiles set active_wallet_id = null
where active_wallet_id in (select id from public.wallets where name = 'Seed Bank Account');
update public.wallets set budget = 0 where name = 'Seed Bank Account';
delete from public.wallets where name = 'Seed Bank Account';

-- ---- 2. Parameters ----
create temp table sp (n int primary key, label text, base_income numeric, ratio numeric, cnt int, boost text[]);
insert into sp values
  (1, 'frugal student',   6000, 0.85,  22, array['Food','Fare','Education']),
  (2, 'balanced',        28000, 0.72,  34, array[]::text[]),
  (3, 'overspender',     22000, 1.12,  45, array['Shopping','Entertainment','Electronics']),
  (4, 'high earner',     75000, 0.45,  30, array['Insurance','Tax','Shopping']),
  (5, 'commuter',        20000, 0.80,  38, array['Fare','Gas Money','Transportation']),
  (6, 'gamer',            8000, 0.95,  32, array['Video Games','Entertainment','Electronics']),
  (7, 'family household',45000, 0.78,  40, array['Home','Food','Bills','Health','Education']),
  (8, 'low activity',    15000, 0.55,  10, array['Food']);

create temp table sc (category text primary key, w numeric, lo numeric, hi numeric, descs text[], emergency boolean);
insert into sc values
  ('Food',           10,  60,  900, array['Jollibee','Mang Inasal','Grocery run','Milk tea','Wet market','Coffee','Lunch at canteen'], false),
  ('Fare',            6,  15,  250, array['Jeepney fare','MRT/LRT load','Grab ride','Tricycle'], false),
  ('Gas Money',       3, 300, 2500, array['Shell fuel','Petron fuel','Caltex fuel'], false),
  ('Video Games',     2, 100, 3500, array['Steam purchase','Mobile game top-up','PS Store','Game pass'], false),
  ('Shopping',        4, 200, 6000, array['Shopee order','Lazada order','Mall clothes','SM Department Store'], false),
  ('Bills',           3, 500, 5500, array['Meralco bill','Water bill','Internet bill','Subscription'], false),
  ('Education',       2, 150, 8000, array['Tuition installment','School supplies','Online course','Books'], false),
  ('Electronics',     1, 500,25000, array['Phone accessories','Earbuds','Keyboard','Power bank'], false),
  ('Entertainment',   3, 150, 2500, array['Cinema tickets','Concert','Netflix','Spotify','Arcade'], false),
  ('Health',          2, 100, 6000, array['Pharmacy','Clinic consultation','Dental check-up','Vitamins'], true),
  ('Home',            2, 200, 9000, array['Hardware store','Furniture','Cleaning supplies','Repairs'], true),
  ('Insurance',       1, 800, 7000, array['Insurance premium','HMO payment'], true),
  ('Social',          2, 200, 3000, array['Birthday gift','Dinner with friends','Pasalubong'], false),
  ('Sport',           1, 150, 3500, array['Gym membership','Badminton court','Running shoes'], false),
  ('Tax',             1, 500,12000, array['Tax payment','BIR fee'], false),
  ('Telephone',       2, 100,  999, array['Globe load','Smart load','Postpaid plan'], false),
  ('Transportation',  2, 100, 3500, array['Bus ticket','Car maintenance','Parking fee','Toll'], true);

-- pay events: day NULL = random day 3..26; dest = wallet kind
create temp table pay (n int, day int, source text, amt numeric, prob numeric, dest text);
insert into pay values
  (1,  1, 'Allowance',  6000, 1.00, 'main'),
  (1, null, 'Freelance', 2200, 0.45, 'gcash'),
  (2, 15, 'Salary',    14000, 1.00, 'main'),
  (2, 30, 'Salary',    14000, 1.00, 'main'),
  (2, null, 'Freelance', 3500, 0.30, 'gcash'),
  (3,  1, 'Salary',    22000, 1.00, 'main'),
  (3, null, 'Business',  6000, 0.50, 'main'),
  (3, null, 'Gift',      1500, 0.30, 'gcash'),
  (4,  1, 'Salary',    75000, 1.00, 'main'),
  (4, null, 'Investment',6000, 0.80, 'emergency'),
  (5,  5, 'Salary',    20000, 1.00, 'main'),
  (5, null, 'Gift',      1000, 0.25, 'gcash'),
  (6,  1, 'Allowance',  8000, 1.00, 'main'),
  (6, null, 'Freelance', 4000, 0.60, 'gcash'),
  (6, null, 'Gift',      2000, 0.30, 'gcash'),
  (7,  1, 'Salary',    45000, 1.00, 'main'),
  (7, null, 'Business',  8500, 0.70, 'main'),
  (8,  1, 'Salary',    15000, 1.00, 'main');

create temp table su as
  select id as user_id, (((row_number() over (order by id)) - 1) % 8 + 1)::int as n from auth.users;

create temp table months as
  select m::date as m,
         extract(day from (m + interval '1 month' - interval '1 day'))::int as dim,
         case when m::date = date '2026-10-01' then 12
              else extract(day from (m + interval '1 month' - interval '1 day'))::int end as days
  from generate_series(date '2026-05-01', date '2026-10-01', interval '1 month') m;

-- ---- 3. Expenses ----
create temp table um as
select su.user_id, su.n, mo.m, mo.days, mo.dim, p.label, p.boost,
       greatest(1, round(p.cnt * mo.days / 31.0)::int) as k,
       p.base_income * p.ratio * (0.8 + random() * 0.45) * mo.days / mo.dim as target
from su join sp p on p.n = su.n cross join months mo;

create temp table raw as
select um.user_id, um.m, um.days, um.label, um.target, g,
       cs.category, cs.descs, cs.emergency,
       ((cs.lo + (cs.hi - cs.lo) * power(random(), 2))
         * case when random() < 0.03 then 3 else 1 end) as raw_amount,
       w.id as wallet_id
from um
cross join lateral generate_series(1, um.k) g
cross join lateral (
  select s.* from sc s
  where g is not null
  order by -ln(random()) / (s.w * case when s.category = any (um.boost) then 4 else 1 end)
  limit 1
) cs
cross join lateral (
  select w2.id from public.wallets w2
  where w2.user_id = um.user_id and w2.deleted_at is null and g is not null
    and w2.name in ('Main Spending Wallet','GCash / Digital Wallet','Daily Allowance Wallet','Emergency & Savings Fund')
  order by -ln(random()) / (case w2.name when 'Main Spending Wallet' then 65
                                           when 'Emergency & Savings Fund' then 10 else 25 end)
  limit 1
) w;

insert into public.expenses (user_id, wallet_id, category_id, category_name, amount, description, spent_on, metadata)
select r.user_id, r.wallet_id, c.id, r.category,
  greatest(5, round((r.raw_amount / sum(r.raw_amount) over (partition by r.user_id, r.m) * r.target)::numeric, 2)),
  r.descs[1 + floor(random() * array_length(r.descs, 1))::int],
  r.m + floor(random() * r.days)::int,
  jsonb_build_object(
    'seed', 'cashflow-2026-10-12',
    'source', 'user_entry',
    'note', 'Seeded cash-flow test record (' || r.label || ')',
    'payment_method', (array['Cash','GCash','Maya','Debit Card','Credit Card'])[1 + floor(random() * 5)::int],
    'is_emergency', r.emergency and random() < 0.25
  )
from raw r
left join public.categories c on c.user_id = r.user_id and lower(c.name) = lower(r.category);

-- ---- 4. Incomes (no future dates) ----
insert into public.incomes (user_id, wallet_id, source, amount, description, received_on, metadata)
select e.user_id, e.wallet_id, e.source, e.amount, e.description, e.received_on,
       jsonb_build_object('seed', 'cashflow-2026-10-12')
from (
  select su.user_id, dw.id as wallet_id, pay.source,
         round((pay.amt * case when pay.source in ('Salary','Allowance') then 1 else 0.9 + random() * 0.2 end)::numeric, 2) as amount,
         case pay.source when 'Salary' then 'Salary payout'
                         when 'Allowance' then 'Monthly allowance'
                         when 'Freelance' then 'Freelance project payment'
                         when 'Business' then 'Business sales'
                         when 'Investment' then 'Investment dividends'
                         else 'Cash gift' end as description,
         (mo.m + (least(coalesce(pay.day, 3 + floor(random() * 24)::int), mo.dim) - 1))::date as received_on
  from su
  join pay on pay.n = su.n
  cross join months mo
  cross join lateral (
    select w.id from public.wallets w
    where w.user_id = su.user_id and w.deleted_at is null
      and w.name in ('Main Spending Wallet','GCash / Digital Wallet','Daily Allowance Wallet','Emergency & Savings Fund')
    order by (w.name = case pay.dest when 'main' then 'Main Spending Wallet'
                                      when 'gcash' then 'GCash / Digital Wallet'
                                      else 'Emergency & Savings Fund' end) desc,
             (w.name = 'Main Spending Wallet') desc
    limit 1
  ) dw
  where random() < pay.prob
) e
where e.received_on <= date '2026-10-12';

-- ---- 5. Wallet balances = opening + incomes - expenses (never below 0) ----
update public.wallets w
set budget = greatest(0, round(op.opening + coalesce(i.s, 0) - coalesce(x.s, 0), 2))
from (
  select id, case name when 'Main Spending Wallet' then 35000
                       when 'Emergency & Savings Fund' then 60000 else 15000 end as opening
  from public.wallets
  where deleted_at is null
    and name in ('Main Spending Wallet','GCash / Digital Wallet','Daily Allowance Wallet','Emergency & Savings Fund')
) op
left join (select wallet_id, sum(amount) s from public.incomes
           where metadata->>'seed' = 'cashflow-2026-10-12' group by 1) i on i.wallet_id = op.id
left join (select wallet_id, sum(amount) s from public.expenses
           where metadata->>'seed' = 'cashflow-2026-10-12' group by 1) x on x.wallet_id = op.id
where w.id = op.id;

-- ---- 6. Goals (one active goal per user max) ----
insert into public.goals (user_id, goal_name, target_amount, current_amount, attitude, target_date, is_active, completed)
select su.user_id, g.name,
       round(g.mult * p.base_income * p.ratio + g.floor_amt, 0)::numeric(14,2),
       round((g.mult * p.base_income * p.ratio + g.floor_amt) * g.progress, 2),
       (array['Normal','Moderate','Aggressive'])[1 + (su.n + g.shift) % 3],
       date '2026-10-12' + (60 + su.n * 20 + g.shift * 30),
       g.active and not exists (select 1 from public.goals x where x.user_id = su.user_id and x.is_active),
       false
from su join sp p on p.n = su.n
cross join lateral (values
  ('Emergency Buffer (3 Months)',      3.0, 0::numeric,     (0.15 + su.n * 0.08), true,  0),
  ('Ergonomic Workstation Setup',      0.0, 18000::numeric, (0.10 + su.n * 0.07), false, 1)
) as g(name, mult, floor_amt, progress, active, shift);

-- ---- 7. AI forecasts + advisories derived from the new data ----
insert into public.ai_forecasts (user_id, period_type, period_start, period_end, projected_spending,
  projected_savings, actual_spending_snapshot, summary, warnings, confidence_score, generated_by, metadata)
select su.user_id, 'monthly', date '2026-10-01', date '2026-10-31',
  round(coalesce(t.spent, 0) / 12.0 * 31, 2),
  round(greatest(0, coalesce(t.inc, 0) - coalesce(t.spent, 0) / 12.0 * 31), 2),
  round(coalesce(t.spent, 0), 2),
  'Projected month-end spending of ₱' || round(coalesce(t.spent, 0) / 12.0 * 31, 2) ||
    ' against ₱' || round(coalesce(t.inc, 0), 2) || ' income this month.',
  case when coalesce(t.spent, 0) / 12.0 * 31 > coalesce(t.inc, 0)
       then '["Projected spending exceeds this month''s income"]'::jsonb else '[]'::jsonb end,
  round((0.6 + (su.n % 5) * 0.08)::numeric, 2), 'system',
  jsonb_build_object('seed', 'cashflow-2026-10-12')
from su
left join lateral (
  select (select sum(e.amount) from public.expenses e
           where e.user_id = su.user_id and e.spent_on between date '2026-10-01' and date '2026-10-12'
             and coalesce((e.metadata->>'is_emergency')::boolean, false) = false) as spent,
         (select sum(i.amount) from public.incomes i
           where i.user_id = su.user_id and i.received_on between date '2026-10-01' and date '2026-10-31') as inc
) t on true;

insert into public.ai_advisories (user_id, advisory_type, title, suggestion, advice, financial_health_score,
  priority, is_read, generated_by, metadata)
select su.user_id, a.t, a.title, 'Seeded advisory for cash-flow testing.',
  'You have spent ₱' || round(coalesce(t.spent, 0), 2) || ' of ₱' || round(coalesce(t.inc, 0), 2) ||
    ' income so far this month. Set aside an extra ₱' || (su.n * 250 + a.extra) || ' this week to protect your savings.',
  least(95, 35 + su.n * 7 + a.shift),
  (array['low','medium','high','urgent'])[1 + (su.n + a.shift) % 4],
  su.n % 2 = 0, 'system', jsonb_build_object('seed', 'cashflow-2026-10-12')
from su
left join lateral (
  select (select sum(e.amount) from public.expenses e
           where e.user_id = su.user_id and e.spent_on between date '2026-10-01' and date '2026-10-12') as spent,
         (select sum(i.amount) from public.incomes i
           where i.user_id = su.user_id and i.received_on between date '2026-10-01' and date '2026-10-31') as inc
) t on true
cross join (values
  ('weekly_review',  'Weekly Spending Review', 100, 0),
  ('category_alert', 'Category Alert',         400, 9)
) as a(t, title, extra, shift);

-- ---- 8. Summary: per user, per month ----
select su.n as persona, to_char(mo.m, 'YYYY-MM') as month,
       coalesce((select sum(i.amount) from public.incomes i
                  where i.user_id = su.user_id and date_trunc('month', i.received_on) = mo.m), 0) as income,
       coalesce((select sum(e.amount) from public.expenses e
                  where e.user_id = su.user_id and date_trunc('month', e.spent_on) = mo.m), 0) as expenses
from su cross join months mo
order by su.n, mo.m;
