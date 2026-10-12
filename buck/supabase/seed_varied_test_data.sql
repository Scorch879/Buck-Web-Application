-- Additive, tagged test data for deployment testing (NOT a migration; run manually).
-- Adds varied wallets, expenses, goals, AI forecasts and advisories for every existing auth user.
-- Every inserted row is tagged: expenses/forecasts/advisories metadata->>'seed' = 'varied-2026-10-12',
-- wallets are named 'Seed Bank Account', goals are named with the prefix 'Seed: '.
-- Existing rows are never modified. Wallet budgets of existing wallets are untouched.
--
-- UNDO (run in this order):
--   delete from public.ai_advisories where metadata->>'seed' = 'varied-2026-10-12';
--   delete from public.ai_forecasts  where metadata->>'seed' = 'varied-2026-10-12';
--   delete from public.expenses      where metadata->>'seed' = 'varied-2026-10-12';
--   delete from public.goals         where goal_name like 'Seed: %';
--   update public.wallets set budget = 0 where name = 'Seed Bank Account';
--   delete from public.wallets       where name = 'Seed Bank Account';

do $$
begin
  if exists (select 1 from public.expenses where metadata->>'seed' = 'varied-2026-10-12') then
    raise exception 'Seed data already present; run the UNDO block first';
  end if;
end $$;

create temp table seed_persona (n int primary key, label text, scale numeric, cnt int, boost text[]);
insert into seed_persona values
  (1, 'frugal student',   0.5,  90, array['Food','Fare','Education']),
  (2, 'balanced',         1.0, 140, array[]::text[]),
  (3, 'overspender',      1.8, 180, array['Shopping','Entertainment','Electronics']),
  (4, 'high earner',      2.5, 120, array['Insurance','Tax','Shopping']),
  (5, 'commuter',         1.0, 150, array['Fare','Gas Money','Transportation']),
  (6, 'gamer',            1.2, 130, array['Video Games','Entertainment','Electronics']),
  (7, 'family household', 1.6, 160, array['Home','Food','Bills','Health','Education']),
  (8, 'low activity',     0.8,  40, array['Food']);

create temp table seed_cat (category text primary key, w numeric, lo numeric, hi numeric, descs text[], emergency boolean);
insert into seed_cat values
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

create temp table seed_user as
  select id as user_id, (row_number() over (order by id))::int as n from auth.users;

-- One extra wallet per user with varied balances.
insert into public.wallets (user_id, name, budget)
select user_id, 'Seed Bank Account', (n * 1750 + 2500)::numeric(14,2) from seed_user;

-- Expenses over the 120 days up to 2026-10-12.
insert into public.expenses (user_id, wallet_id, category_id, category_name, amount, description, spent_on, metadata)
select
  su.user_id,
  w.id,
  c.id,
  cs.category,
  round(((cs.lo + (cs.hi - cs.lo) * power(random(), 2)) * p.scale
         * case when random() < 0.03 then 3 else 1 end)::numeric, 2),
  cs.descs[1 + floor(random() * array_length(cs.descs, 1))::int],
  date '2026-10-12' - floor(random() * 120)::int,
  jsonb_build_object(
    'seed', 'varied-2026-10-12',
    'source', 'user_entry',
    'note', 'Seeded varied test record (' || p.label || ')',
    'payment_method', (array['Cash','GCash','Maya','Debit Card','Credit Card'])[1 + floor(random() * 5)::int],
    'is_emergency', cs.emergency and random() < 0.25
  )
from seed_user su
join seed_persona p on p.n = ((su.n - 1) % 8) + 1
cross join lateral generate_series(1, p.cnt) g
cross join lateral (
  select s.* from seed_cat s
  where g is not null
  order by -ln(random()) / (s.w * case when s.category = any (p.boost) then 4 else 1 end)
  limit 1
) cs
cross join lateral (
  select w2.id from public.wallets w2
  where w2.user_id = su.user_id and w2.deleted_at is null and g is not null
  order by random() limit 1
) w
left join public.categories c on c.user_id = su.user_id and lower(c.name) = lower(cs.category);

-- One inactive goal per user in varied states (the unique index allows one active goal only).
insert into public.goals (user_id, goal_name, target_amount, current_amount, attitude, target_date, is_active, completed)
select
  su.user_id,
  'Seed: ' || (array['Emergency Fund','New Laptop','Travel to Cebu','Motorcycle Downpayment','Tuition Reserve','Wedding Savings','Home Repair','Gadget Upgrade'])[su.n],
  (array[20000, 55000, 15000, 80000, 30000, 120000, 25000, 18000])[su.n]::numeric(14,2),
  case when su.n % 4 = 1 then (array[20000, 55000, 15000, 80000, 30000, 120000, 25000, 18000])[su.n]
       else round((array[20000, 55000, 15000, 80000, 30000, 120000, 25000, 18000])[su.n] * (su.n * 0.11))::numeric end,
  (array['Normal','Moderate','Aggressive'])[1 + su.n % 3],
  date '2026-10-12' + (su.n * 45),
  false,
  su.n % 4 = 1
from seed_user su;

-- One current-month AI forecast per user derived from their real expense totals.
insert into public.ai_forecasts (user_id, period_type, period_start, period_end, projected_spending,
  projected_savings, actual_spending_snapshot, summary, warnings, confidence_score, generated_by, metadata)
select
  su.user_id, 'monthly', date '2026-10-01', date '2026-10-31',
  round(coalesce(t.spent, 0) / 12.0 * 31, 2),
  round(greatest(0, (su.n * 1500) - coalesce(t.spent, 0) / 12.0 * 31 * 0.2), 2),
  round(coalesce(t.spent, 0), 2),
  'Seeded forecast for load testing: projected month-end spending of ₱' ||
    round(coalesce(t.spent, 0) / 12.0 * 31, 2) || '.',
  case when su.n % 3 = 0 then '["Spending trend is above the 30-day average"]'::jsonb else '[]'::jsonb end,
  round((0.6 + (su.n % 5) * 0.08)::numeric, 2),
  'system',
  jsonb_build_object('seed', 'varied-2026-10-12')
from seed_user su
left join lateral (
  select sum(e.amount) spent from public.expenses e
  where e.user_id = su.user_id and e.spent_on between date '2026-10-01' and date '2026-10-12'
    and coalesce((e.metadata->>'is_emergency')::boolean, false) = false
) t on true;

-- Two AI advisories per user with varied priority and health scores.
insert into public.ai_advisories (user_id, advisory_type, title, suggestion, advice, financial_health_score,
  priority, is_read, generated_by, metadata)
select
  su.user_id, a.t, a.title,
  'Seeded advisory for load testing.',
  'Your recent spending is trending ' || a.trend || ' your usual pace. Consider setting aside an extra ₱' ||
    (su.n * 250 + a.extra) || ' this week to stay on track.',
  least(95, 35 + su.n * 7 + a.shift),
  (array['low','medium','high','urgent'])[1 + (su.n + a.shift) % 4],
  su.n % 2 = 0,
  'system',
  jsonb_build_object('seed', 'varied-2026-10-12')
from seed_user su
cross join (values
  ('weekly_review',  'Weekly Spending Review', 'near',  100, 0),
  ('category_alert', 'Category Alert',         'above', 400, 9)
) as a(t, title, trend, extra, shift);

select 'wallets' t, count(*) from public.wallets where name = 'Seed Bank Account'
union all select 'expenses', count(*) from public.expenses where metadata->>'seed' = 'varied-2026-10-12'
union all select 'goals', count(*) from public.goals where goal_name like 'Seed: %'
union all select 'forecasts', count(*) from public.ai_forecasts where metadata->>'seed' = 'varied-2026-10-12'
union all select 'advisories', count(*) from public.ai_advisories where metadata->>'seed' = 'varied-2026-10-12';
