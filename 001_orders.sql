# SQL script to create the `orders` table for the Netlify DB (Neon Postgres)
#
# This script creates a table with columns matching your e-commerce order
# schema. It includes sensible defaults and constraints to ensure data integrity.
# You should run this script in your Neon dashboard's SQL editor to set up the
# table before deploying your Netlify functions.

-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT NOT NULL,
  name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  -- Use jsonb to store an array of items { sku, name, qty, price }
  items JSONB NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL,  -- cashapp | venmo | zelle | bitcoin
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | fulfilled | cancelled
  submitted_to_supplier BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_order_id TEXT,
  tracking_number TEXT,
  payment_proof TEXT
);