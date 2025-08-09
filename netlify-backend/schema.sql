
create table if not exists orders (
  id bigint generated always as identity primary key,
  order_id text unique not null,
  status text not null default 'Pending_Payment',
  method text not null,
  amount_usd numeric(10,2) not null,
  btc_amount numeric(18,8),
  customer_email text not null,
  customer_name text,
  shipping_json jsonb not null,
  items_json jsonb not null,
  supplier_order_id text,
  tracking_number text,
  proof_urls jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace function touch_orders()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_touch_orders on orders;
create trigger trg_touch_orders before update on orders
for each row execute procedure touch_orders();
