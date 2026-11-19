-- pgTAP tests: one need filled in parts by several companies (0039, ADR 0028 D3).
-- Rolls back.
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

create or replace function tests_authenticate(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000c001', 'corp1@test.dev');
insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Alpha GmbH', 'tree', 'verified'),
  ('00000000-0000-0000-0000-0000000000c2', 'Beta GmbH', 'tree', 'verified'),
  ('00000000-0000-0000-0000-0000000000c3', 'Gamma GmbH', 'tree', 'verified');
insert into ngos (id, name, verification_state) values
  ('00000000-0000-0000-0000-0000000000e1', 'Verified e.V.', 'verified');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000c001', 'corp1@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null);

-- The need wants 100; three companies could each give some.
insert into needs (id, ngo_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Laptops', 'IT', 100, 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'Anything', 'IT', null, 'open');
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Alpha laptops', 'IT', 60, 'open'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', 'Beta laptops', 'IT', 70, 'open'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c3', 'Gamma laptops', 'IT', 50, 'open'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000c3', 'Gamma misc', 'IT', 8, 'open');

select tests_authenticate('00000000-0000-0000-0000-00000000ad01');

-- 1) Proposals take parts and count the need down ---------------------------
select is(need_open_quantity('00000000-0000-0000-0000-0000000000d1'), 100, 'nothing proposed: all 100 are open');
select is(
  (select quantity from propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') p),
  60, 'by default a part is what the listing gives (60)'
);
select is(need_open_quantity('00000000-0000-0000-0000-0000000000d1'), 40, 'the need shows 40 still open');
select is(
  (select quantity from propose_match('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1') p),
  40, 'the next part is capped at what is still open (40 of 70)'
);
select is(need_open_quantity('00000000-0000-0000-0000-0000000000d1'), 0, 'the need is fully covered');
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'need_fully_covered', 'no further proposal once the parts add up'
);

-- 2) Explicit quantities are validated ---------------------------------------
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d2', 0) $$,
  'P0001', 'invalid_quantity', 'a part must be positive'
);
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d2', 51) $$,
  'P0001', 'quantity_exceeds_listing', 'a part cannot exceed the listing'
);
select is(need_open_quantity('00000000-0000-0000-0000-0000000000d2'), null, 'a need without a quantity has no remainder to show');
select is(
  (select quantity from propose_match('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000d2') p),
  8, 'a need without a quantity takes the listing as it is'
);

-- 3) The need follows its parts ------------------------------------------------
-- NGO confirms part one (60 of 100): the need stays open for the rest.
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok(
  $$ select transition_match((select id from matches where listing_id = '00000000-0000-0000-0000-0000000000b1'), 'ngo_confirmed') $$,
  'NGO confirms the first part'
);
select is(
  (select state from needs where id = '00000000-0000-0000-0000-0000000000d1'), 'open'::need_state,
  'a part-filled need stays open'
);
select lives_ok(
  $$ select transition_match((select id from matches where listing_id = '00000000-0000-0000-0000-0000000000b2'), 'ngo_confirmed') $$,
  'NGO confirms the second part'
);
select is(
  (select state from needs where id = '00000000-0000-0000-0000-0000000000d1'), 'matched'::need_state,
  'confirmed parts cover the need: matched'
);

-- 4) A cancelled part frees its share and reopens the need ---------------------
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select lives_ok(
  $$ select transition_match((select id from matches where listing_id = '00000000-0000-0000-0000-0000000000b2'), 'cancelled') $$,
  'Ops cancels the second part'
);
select is(need_open_quantity('00000000-0000-0000-0000-0000000000d1'), 40, 'its 40 are open again');
select is(
  (select state from needs where id = '00000000-0000-0000-0000-0000000000d1'), 'open'::need_state,
  'the need reopens'
);

-- 5) Completed parts fulfil the need only when they add up ----------------------
update matches set state = 'completed'
  where listing_id = '00000000-0000-0000-0000-0000000000b1';
select refresh_need_state('00000000-0000-0000-0000-0000000000d1');
select is(
  (select state from needs where id = '00000000-0000-0000-0000-0000000000d1'), 'open'::need_state,
  '60 of 100 delivered: not fulfilled'
);
select propose_match('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d1', 40);
update matches set state = 'completed'
  where listing_id = '00000000-0000-0000-0000-0000000000b3';
select refresh_need_state('00000000-0000-0000-0000-0000000000d1');
select is(
  (select state from needs where id = '00000000-0000-0000-0000-0000000000d1'), 'fulfilled'::need_state,
  '100 of 100 delivered: fulfilled'
);

-- 6) The browsable directory shows what is still open ----------------------------
update needs set state = 'open' where id = '00000000-0000-0000-0000-0000000000d1';
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select is(
  (select quantity_remaining from open_needs_directory() where need_id = '00000000-0000-0000-0000-0000000000d1'),
  0, 'the directory exposes quantity_remaining'
);

select * from finish();
rollback;
