"""The AI Forecaster's model: fitted per user, per request, no I/O.

Spending is intermittent: most categories are not bought every day, and the
amount changes each time. So each category is modelled as

    chance of spending on day d  = base rate (recent, recency-weighted)
                                   x weekday effect x payday effect
    amount when it happens       = drawn from the user's own recent amounts

plus recurring items (bills, subscriptions) placed on their next due date.
Simulating many possible futures gives a range (P10-P90, the SRS's 80% band)
instead of one flat number. A backtest on the last 14 days picks the history
window (14, 30 or 60 days) that forecasts this user best and measures how far
off it was, which becomes the confidence score.

Pure Python + numpy and deterministic: the same data always gives the same
forecast (the random seed comes from the data).
"""

import hashlib
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from statistics import median

import numpy as np

WINDOWS = (14, 30, 60)
HISTORY_DAYS = 180
BACKTEST_DAYS = 14
SIMULATIONS = 1000
BACKTEST_SIMULATIONS = 300
MIN_DAYS = 14        # below this (or MIN_EXPENSES) the forecast is "low data"
MIN_EXPENSES = 10
OUTLIER_MIN_SAMPLES = 8
PAYDAY_WINDOW = 3    # the income day and the 2 days after it
MAX_DAILY_CHANCE = 0.97
LOW_DATA_NOISE = 0.5  # extra spread on amounts when history is thin


@dataclass(frozen=True)
class Expense:
    day: date
    amount: float
    category: str
    wallet: str | None = None
    label: str = ""          # cleaned description, shown to the user only
    emergency: bool = False  # metadata.is_emergency: left out of the baseline


@dataclass(frozen=True)
class Income:
    day: date
    amount: float


@dataclass
class Recurring:
    category: str
    label: str
    every_days: int
    amount: float
    next_due: date
    wallet: str | None
    members: list[int] = field(default_factory=list)  # expense indexes it explains

    @property
    def cadence(self) -> str:
        return "weekly" if self.every_days <= 8 else "monthly"


@dataclass
class CategoryFit:
    name: str
    chance: float           # chance of any spending on a typical day
    weekday: list[float]    # Monday..Sunday multipliers for this category, mean 1
    payday: tuple[float, float]  # multipliers inside / outside the payday window
    amounts: np.ndarray     # past daily totals to draw from
    weights: np.ndarray     # recency weights, sum to 1


@dataclass
class Fit:
    categories: list[CategoryFit]
    weekday: list[float]    # Monday..Sunday spending vs. a usual day (all categories)
    payday: float           # spending inside the payday window vs. outside (all categories)
    paydays: set[int]       # days of the month income usually lands
    noise: float


# ------------------------------------------------------------------ helpers

def seed_for(*parts: object) -> int:
    digest = hashlib.sha256(repr(parts).encode()).digest()
    return int.from_bytes(digest[:8], "big")


def daterange(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _norm_label(text: str) -> str:
    return re.sub(r"[^a-z]+", " ", text.lower()).strip()[:40]


def first_day(expenses: list[Expense], today: date) -> date:
    earliest = min((e.day for e in expenses), default=today)
    return max(earliest, today - timedelta(days=HISTORY_DAYS - 1))


# ---------------------------------------------------------- data cleaning

def find_outliers(expenses: list[Expense]) -> set[int]:
    """One-offs left out of the baseline: flagged emergencies, and amounts far
    above the category's usual range (Q3 + 3 x IQR, needs 8+ samples)."""
    out = {i for i, e in enumerate(expenses) if e.emergency}
    by_cat: dict[str, list[int]] = defaultdict(list)
    for i, e in enumerate(expenses):
        by_cat[e.category].append(i)
    for idx in by_cat.values():
        if len(idx) < OUTLIER_MIN_SAMPLES:
            continue
        q1, q3 = np.percentile([expenses[i].amount for i in idx], [25, 75])
        limit = q3 + 3 * (q3 - q1)
        out.update(i for i in idx if expenses[i].amount > limit and expenses[i].amount > 2 * q3)
    return out


def find_recurring(expenses: list[Expense], today: date, skip: set[int]) -> list[Recurring]:
    """Same category and description, steady amount, about every week or month,
    and still active. These are placed on their due dates, not simulated."""
    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for i, e in enumerate(expenses):
        key = _norm_label(e.label)
        if i not in skip and key:
            groups[(e.category, key)].append(i)
    found = []
    for (category, _), idx in groups.items():
        if len(idx) < 3:
            continue
        idx.sort(key=lambda i: expenses[i].day)
        days = [expenses[i].day for i in idx]
        gaps = [(b - a).days for a, b in zip(days, days[1:])]
        gap = median(gaps)
        if 6 <= gap <= 8:
            every = 7
        elif 27 <= gap <= 33:
            every = 30
        else:
            continue
        if any(abs(g - gap) > (2 if every == 7 else 5) for g in gaps[-3:]):
            continue
        amounts = [expenses[i].amount for i in idx[-3:]]
        typical = median(amounts)
        if typical <= 0 or (max(amounts) - min(amounts)) / typical > 0.5:
            continue
        last = days[-1]
        if (today - last).days > 2 * every:
            continue  # stopped
        item = Recurring(category, expenses[idx[-1]].label, every, round(typical, 2), last,
                         expenses[idx[-1]].wallet, idx)
        due = _next(item, last)
        while due <= today:
            due = _next(item, due)
        item.next_due = due
        found.append(item)
    return found


def _next(item: Recurring, day: date) -> date:
    return _same_day_next_month(day) if item.every_days == 30 else day + timedelta(days=7)


def _same_day_next_month(day: date) -> date:
    year, month = (day.year + 1, 1) if day.month == 12 else (day.year, day.month + 1)
    for d in (day.day, 30, 29, 28):
        try:
            return date(year, month, d)
        except ValueError:
            continue
    raise ValueError(day)


def recurring_dates(item: Recurring, start: date, end: date) -> list[date]:
    out, due = [], item.next_due
    while due <= end:
        if due >= start:
            out.append(due)
        due = _next(item, due)
    return out


# ------------------------------------------------------------------ fitting

def _weights(ages: np.ndarray, half_life: float) -> np.ndarray:
    return np.power(0.5, ages / half_life)


def _spend_days(expenses: list[Expense], keep: list[int]) -> dict[date, float]:
    totals: dict[date, float] = defaultdict(float)
    for i in keep:
        totals[expenses[i].day] += expenses[i].amount
    return totals


def weekday_effects(spend_days: dict[date, float], start: date, end: date) -> list[float]:
    """How much more likely spending is on each weekday, shrunk towards 1 so a
    few busy Saturdays don't make a "weekend spender"."""
    days = daterange(start, end)
    if not days:
        return [1.0] * 7
    overall = sum(1 for d in days if d in spend_days) / len(days)
    if overall == 0:
        return [1.0] * 7
    prior = 4.0  # pseudo-days at the overall rate
    rates = []
    for wd in range(7):
        n = [d for d in days if d.weekday() == wd]
        hits = sum(1 for d in n if d in spend_days)
        rates.append((hits + prior * overall) / (len(n) + prior))
    mean = sum(rates) / 7
    return [r / mean for r in rates]


def weekday_spending(spend_days: dict[date, float], start: date, end: date) -> list[float]:
    """Average spending on each weekday vs. a usual day (amounts, all categories),
    shrunk towards 1. Used to describe habits ("weekend spender")."""
    days = daterange(start, end)
    overall = sum(spend_days.get(d, 0.0) for d in days) / len(days) if days else 0.0
    if overall == 0:
        return [1.0] * 7
    prior = 4.0
    out = []
    for wd in range(7):
        n = [d for d in days if d.weekday() == wd]
        out.append((sum(spend_days.get(d, 0.0) for d in n) + prior * overall) / (len(n) + prior) / overall)
    return out


def in_payday_window(day: date, paydays: set[int]) -> bool:
    """On a usual income day or the 2 days after it (wrapping month ends)."""
    dom = min(day.day, 30)
    return any((dom - p) % 30 < PAYDAY_WINDOW for p in paydays)


def payday_effect(spend_days: dict[date, float], start: date, end: date, paydays: set[int]) -> float:
    """Spending per day inside the payday window vs. outside, shrunk towards 1."""
    if not paydays:
        return 1.0
    inside, outside = [], []
    for d in daterange(start, end):
        (inside if in_payday_window(d, paydays) else outside).append(spend_days.get(d, 0.0))
    if len(inside) < 6 or not outside or sum(outside) == 0:
        return 1.0
    ratio = (sum(inside) / len(inside)) / (sum(outside) / len(outside))
    weight = len(inside) / (len(inside) + 12)
    return float(min(2.5, max(0.5, 1 + (ratio - 1) * weight)))


def payday_chance(spend_days, start: date, end: date, paydays: set[int]) -> tuple[float, float]:
    """How much likelier this category is inside vs. outside the payday window
    (keeps the overall rate), shrunk towards 1."""
    days = daterange(start, end)
    inside = [d for d in days if in_payday_window(d, paydays)]
    if not paydays or len(inside) < 6 or len(inside) == len(days):
        return (1.0, 1.0)
    outside = [d for d in days if not in_payday_window(d, paydays)]
    overall = sum(1 for d in days if d in spend_days) / len(days)
    if overall == 0:
        return (1.0, 1.0)
    prior = 4.0

    def rate(group: list[date]) -> float:
        return (sum(1 for d in group if d in spend_days) + prior * overall) / (len(group) + prior) / overall
    return (rate(inside), rate(outside))


def usual_paydays(incomes: list[Income]) -> set[int]:
    """Days of the month income lands at least twice (e.g. the 15th and 30th)."""
    counts: dict[int, int] = defaultdict(int)
    for inc in incomes:
        counts[min(inc.day.day, 30)] += 1
    return {d for d, n in counts.items() if n >= 2}


def fit(expenses: list[Expense], incomes: list[Income], today: date, window: int,
        skip: set[int]) -> Fit:
    """Fits the model on everything up to and including `today`."""
    start = first_day([e for e in expenses if e.day <= today], today)
    keep = [i for i, e in enumerate(expenses) if i not in skip and start <= e.day <= today]
    observed = (today - start).days + 1
    low = observed < MIN_DAYS or len(keep) < MIN_EXPENSES
    window = min(window, observed)
    half_life = max(7.0, window / 2)

    spend_days = _spend_days(expenses, keep)
    weekly = observed >= 28
    weekday = weekday_spending(spend_days, start, today) if weekly else [1.0] * 7
    paydays = usual_paydays([i for i in incomes if start <= i.day <= today])
    payday = payday_effect(spend_days, start, today, paydays) if observed >= 28 else 1.0

    by_cat: dict[str, dict[date, float]] = defaultdict(lambda: defaultdict(float))
    for i in keep:
        by_cat[expenses[i].category][expenses[i].day] += expenses[i].amount

    window_days = np.array(daterange(today - timedelta(days=window - 1), today))
    ages = np.array([(today - d).days for d in window_days], dtype=float)
    w = _weights(ages, half_life)
    cats = []
    for name in sorted(by_cat):
        days = by_cat[name]
        hit = np.array([1.0 if d in days else 0.0 for d in window_days])
        long_rate = len(days) / observed
        # One pseudo-day at the long-run rate keeps rare categories alive.
        chance = float((np.sum(w * hit) + long_rate) / (np.sum(w) + 1.0))
        # Amounts: recent daily totals; widen to all history when there are few.
        recent = sorted((d, a) for d, a in days.items() if (today - d).days < max(window, 60))
        if len(recent) < 5:
            recent = sorted(days.items())
        amt = np.array([a for _, a in recent])
        aw = _weights(np.array([(today - d).days for d, _ in recent], dtype=float), max(window, 30.0))
        # Weekly pattern per category: daily Food must not hide weekend Entertainment.
        enough = weekly and len(days) >= 6
        wd = weekday_effects(days, start, today) if enough else [1.0] * 7
        pay = payday_chance(days, start, today, paydays) if enough else (1.0, 1.0)
        cats.append(CategoryFit(name, chance, wd, pay, amt, aw / aw.sum()))
    return Fit(cats, weekday, payday, paydays, LOW_DATA_NOISE if low else 0.0)


# --------------------------------------------------------------- simulating

@dataclass
class Simulation:
    days: list[date]
    total: np.ndarray                    # (n, H) spending per path and day
    by_category: dict[str, np.ndarray]   # name -> (n, H)


def simulate(model: Fit, recurring: list[Recurring], days: list[date], n: int, seed: int) -> Simulation:
    rng = np.random.default_rng(seed)
    horizon = len(days)
    inside = np.array([in_payday_window(d, model.paydays) for d in days])
    total = np.zeros((n, horizon))
    by_cat: dict[str, np.ndarray] = {}
    for cat in model.categories:
        effect = np.array([cat.weekday[d.weekday()] for d in days]) * np.where(inside, *cat.payday)
        chance = np.clip(cat.chance * effect, 0.0, MAX_DAILY_CHANCE)
        happens = rng.random((n, horizon)) < chance
        amount = rng.choice(cat.amounts, size=(n, horizon), p=cat.weights)
        if model.noise:
            amount = amount * rng.lognormal(-model.noise ** 2 / 2, model.noise, size=(n, horizon))
        paths = happens * amount
        by_cat[cat.name] = paths
        total += paths
    index = {d: i for i, d in enumerate(days)}
    for item in recurring:
        fixed = np.zeros(horizon)
        for d in recurring_dates(item, days[0], days[-1]):
            fixed[index[d]] += item.amount
        if fixed.any():
            by_cat[item.category] = by_cat.get(item.category, np.zeros((n, horizon))) + fixed
            total += fixed
    return Simulation(days, total, by_cat)


# --------------------------------------------------------------- backtest

@dataclass
class Backtest:
    window: int
    error: float | None      # mean relative error of the 7- and 14-day totals
    coverage: float | None   # share of held-out days inside the P10-P90 band


def backtest(expenses: list[Expense], incomes: list[Income], today: date, skip: set[int],
             seed: int) -> Backtest:
    """Hides the last 14 days, forecasts them from what came before, and keeps
    the window that was closest. Needs 28+ days before the cut-off."""
    cut = today - timedelta(days=BACKTEST_DAYS)
    start = first_day(expenses, today)
    before = (cut - start).days + 1
    if before < 28:
        return Backtest(min(30, max(1, (today - start).days + 1)), None, None)
    held = daterange(cut + timedelta(days=1), today)
    actual_by_day = _spend_days(expenses, [i for i, e in enumerate(expenses)
                                           if i not in skip and cut < e.day <= today])
    actual = np.array([actual_by_day.get(d, 0.0) for d in held])
    past = [e for e in expenses if e.day <= cut]
    past_skip = {i for i, e in enumerate(expenses) if e.day <= cut and i in skip}
    # Indexes shift once later rows are dropped; map them.
    old_to_new = {old: new for new, old in enumerate(i for i, e in enumerate(expenses) if e.day <= cut)}
    past_skip = {old_to_new[i] for i in past_skip}
    recurring = find_recurring(past, cut, past_skip)
    rec_skip = past_skip | {m for r in recurring for m in r.members}
    best: Backtest | None = None
    for window in WINDOWS:
        if window > before:
            continue
        sim = simulate(fit(past, incomes, cut, window, rec_skip), recurring, held, BACKTEST_SIMULATIONS, seed)
        cum = np.cumsum(sim.total, axis=1)
        mean_cum = cum.mean(axis=0)
        actual_cum = np.cumsum(actual)
        errors = [abs(actual_cum[k] - mean_cum[k]) / max(actual_cum[k], 1.0) for k in (6, BACKTEST_DAYS - 1)]
        error = float(min(1.0, sum(errors) / 2))
        lo, hi = np.percentile(cum, [10, 90], axis=0)
        coverage = float(np.mean((actual_cum >= lo - 0.01) & (actual_cum <= hi + 0.01)))
        if best is None or error < best.error:
            best = Backtest(window, error, coverage)
    return best or Backtest(30, None, None)
