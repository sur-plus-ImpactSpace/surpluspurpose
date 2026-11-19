-- 0017 — make a need post survive contact with how NGOs actually write one.
--
-- Checked against the eight real Tally submissions (form QKv6Np). The schema
-- and the API were both stricter than reality:
--
--   quantity: the API rejected anything without a number > 0. Five of eight
--     would have been turned away — "3-5 Business-Laptops" (lebensmut),
--     "Laptop" (Stadtlabor Zeitz), "Holz / Baumaterial" (BBW), "Laptops" with
--     max volume "unlimited" (Labdoo), "30+" (Kick ins Leben).
--
--   target_date: a plain `date`. Zero of eight gave one. All eight gave an
--     urgency instead: "nicht sehr dringend", "as available", "Wann immer
--     möglich", "when when possible", "As soon as possible", "permanent",
--     "Super wäre 10/2026 - 02/2027", "at the start of the coming school year,
--     ideally on 1 September 2026".
--
-- Nothing here is a legal requirement. A need is a request; the precision the
-- law wants (genaue Bezeichnung der Sachzuwendung, § 50 EStDV) applies to the
-- Zuwendungsbestätigung, which describes what was actually handed over — that
-- comes from the listing and the match, not from this form. So the fix is to
-- be more tolerant, not more detailed.

create type need_urgency as enum ('asap', 'flexible', 'by_date', 'ongoing');

alter table needs
  -- "flexible" is what most NGOs actually mean and what existing rows imply:
  -- they posted without a date because nothing was burning.
  add column if not exists urgency need_urgency not null default 'flexible',
  -- "as many as you have" (Labdoo: unlimited/permanent) is a real answer, not
  -- a missing one. Distinguishes it from quantity simply being unknown.
  add column if not exists quantity_open boolean not null default false;

-- quantity is already nullable in 0001; only the API forced it. Make the
-- intent explicit for anyone reading the schema instead of the API.
comment on column needs.quantity is
  'Optional. NGOs legitimately post without a number ("Laptops", "as many as you have") — see quantity_open. Never require this.';

comment on column needs.urgency is
  'What the NGO means by timing. target_date is only meaningful when urgency = by_date.';

-- Backfill: a row that already carries a date meant by_date.
update needs set urgency = 'by_date' where target_date is not null;
