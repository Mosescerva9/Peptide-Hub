-- Supabase SQL: create an orders table for offline payments/fulfillment
create extension if not exists pgcrypto; -- for gen_random_uuid()

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_id text not null unique,
  email text not null,
  phone text,
  ship_name text not null,
  ship_address1 text not null,
  ship_address2 text,
  ship_city text not null,
  ship_state text not null,
  ship_postal text not null,
  ship_country text not null,
  billing_same boolean not null default true,
  bill_name text,
  bill_address1 text,
  bill_address2 text,
  bill_city text,
  bill_state text,
  bill_postal text,
  bill_country text,
  items jsonb not null,
  payment_method text not null,
  total numeric(10,2) not null,
  status text not null default 'pending',  -- pending | paid | shipped | cancelled
  tracking_number text,
  carrier text,
  tracking_url text
);

-- Helpful index
create index if not exists orders_created_at_idx on orders (created_at desc);
