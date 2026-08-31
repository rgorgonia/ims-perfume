-- ============================================================
-- Perfume IMS — Supabase PostgreSQL Schema (v1)
-- Multi-store, RBAC, perfume-specific variants, financial tracking
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- ENUMS ----------
create type user_role as enum ('system_admin', 'store_manager');
create type concentration_type as enum ('EDT', 'EDP', 'EXTRAIT', 'EDC', 'OIL');
create type note_type as enum ('top', 'heart', 'base');
create type stock_movement_type as enum ('purchase', 'transfer_in', 'transfer_out', 'sale', 'adjustment', 'wastage');
create type ledger_entry_type as enum ('capital_in', 'capital_out', 'store_allocation', 'expense');
create type payment_method as enum ('cash', 'gcash', 'card', 'bank_transfer');

-- ---------- STORES ----------
create table public.stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- PROFILES (1:1 with Supabase auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'store_manager',
  store_id uuid references public.stores(id),           -- null for system_admin
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- PRODUCTS (parent fragrance) ----------
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand text,
  concentration concentration_type not null default 'EDP',
  cost_price numeric(12,2) not null default 0,          -- wholesale/production COGS reference (admin-only)
  retail_price numeric(12,2) not null default 0,        -- default retail; variants may override
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Scent profile tags (normalized)
create table public.product_notes (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  note_type note_type not null,
  note_name text not null,                              -- e.g. 'bergamot', 'sandalwood'
  unique (product_id, note_type, note_name)
);

-- ---------- PRODUCT VARIANTS ----------
create table public.product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size_ml int not null check (size_ml > 0),
  variant_type text not null default 'retail',          -- 'retail' | 'tester' | 'sample' | 'gift_set'
  cost_price numeric(12,2) not null default 0,          -- COGS per unit (ADMIN-ONLY visibility)
  retail_price numeric(12,2) not null default 0,
  low_stock_threshold int not null default 5,
  is_active boolean not null default true,
  unique (product_id, size_ml, variant_type)
);

-- ---------- BATCH / LOT TRACKING ----------
create table public.batches (
  id uuid primary key default uuid_generate_v4(),
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  lot_number text not null,
  manufactured_date date,
  expires_on date,
  created_at timestamptz not null default now(),
  unique (product_variant_id, lot_number)
);

-- ---------- INVENTORY LEVELS (variant x store) ----------
create table public.inventory_levels (
  id uuid primary key default uuid_generate_v4(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  quantity_on_hand int not null default 0 check (quantity_on_hand >= 0),
  updated_at timestamptz not null default now(),
  unique (variant_id, store_id, batch_id)
);

-- Immutable stock movement log (audit trail)
create table public.stock_movements (
  id uuid primary key default uuid_generate_v4(),
  variant_id uuid not null references public.product_variants(id),
  store_id uuid not null references public.stores(id),
  batch_id uuid references public.batches(id),
  movement_type stock_movement_type not null,
  quantity int not null,                                -- positive = in, negative = out
  reference_id uuid,                                    -- sale id, PO id, etc.
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- SUPPLIERS & PURCHASE ORDERS ----------
create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id),
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft',                 -- draft | ordered | received | cancelled
  total_cost numeric(12,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  quantity int not null check (quantity > 0),
  unit_cost numeric(12,2) not null,
  batch_lot_number text
);

-- ---------- SALES ----------
create table public.sales_transactions (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id),
  sold_by uuid not null references auth.users(id),
  payment_method payment_method not null default 'cash',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  -- COGS snapshot captured at sale time so managers never need live cost data
  total_cogs numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references public.sales_transactions(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  batch_id uuid references public.batches(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,                    -- retail price at time of sale
  unit_cogs numeric(12,2) not null default 0            -- COGS snapshot
);

-- ---------- CAPITAL LEDGER (ADMIN-ONLY) ----------
create table public.capital_ledger (
  id uuid primary key default uuid_generate_v4(),
  entry_type ledger_entry_type not null,
  store_id uuid references public.stores(id),           -- null = business-wide
  amount numeric(12,2) not null,                        -- positive = inflow, negative = outflow
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- HELPER FUNCTIONS (used by RLS policies) ----------
create or replace function public.is_system_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'system_admin' and is_active);
$$;

create or replace function public.assigned_store_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select store_id from public.profiles where id = auth.uid() and is_active and store_id is not null
  union
  select id from public.stores where public.is_system_admin();
$$;

-- ---------- TRIGGER: inventory_levels derived from stock_movements ----------
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.inventory_levels (variant_id, store_id, batch_id, quantity_on_hand)
  values (new.variant_id, new.store_id, new.batch_id, new.quantity)
  on conflict (variant_id, store_id, batch_id)
  do update set quantity_on_hand = inventory_levels.quantity_on_hand + new.quantity,
                updated_at = now();
  return new;
end;
$$;

create trigger trg_apply_stock_movement
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

-- ---------- TRIGGER: deduct stock automatically when a sale item is recorded ----------
create or replace function public.deduct_sale_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale public.sales_transactions;
begin
  select * into v_sale from public.sales_transactions where id = new.sale_id;
  insert into public.stock_movements (variant_id, store_id, batch_id, movement_type, quantity, reference_id, created_by)
  values (new.variant_id, v_sale.store_id, new.batch_id, 'sale', -new.quantity, v_sale.id, v_sale.sold_by);
  return new;
end;
$$;

create trigger trg_deduct_sale_stock
after insert on public.sale_items
for each row execute function public.deduct_sale_stock();

-- ---------- TRIGGER: updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_touch_inventory before update on public.inventory_levels
for each row execute function public.touch_updated_at();

-- ---------- INDEXES ----------
create index idx_inv_variant on public.inventory_levels(variant_id);
create index idx_inv_store on public.inventory_levels(store_id);
create index idx_movements_store_time on public.stock_movements(store_id, created_at desc);
create index idx_sales_store_time on public.sales_transactions(store_id, created_at desc);
create index idx_sale_items_variant on public.sale_items(variant_id);
create index idx_notes_product on public.product_notes(product_id);
create index idx_ledger_time on public.capital_ledger(created_at desc);

-- ---------- RPC: dashboard sales summary (see docs/ARCHITECTURE.md §3) ----------
create or replace function public.store_sales_summary(p_store uuid, p_days int default 30)
returns table (day date, revenue numeric, cogs numeric, profit numeric)
language sql security invoker stable as $$
  select date_trunc('day', s.created_at)::date,
         sum(s.total), sum(s.total_cogs), sum(s.total - s.total_cogs)
  from public.sales_transactions s
  where s.store_id = p_store
    and s.created_at >= now() - make_interval(days => p_days)
  group by 1 order by 1;
$$;

-- ---------- VIEW: variant data safe for store managers (no cost_price) ----------
create view public.variant_public_view as
  select id, product_id, sku, size_ml, variant_type, retail_price, low_stock_threshold, is_active
  from public.product_variants;

-- ============================================================
-- RLS ENABLEMENT (policies in sql/002_rls_policies.sql)
-- ============================================================
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_notes enable row level security;
alter table public.product_variants enable row level security;
alter table public.batches enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.sales_transactions enable row level security;
alter table public.sale_items enable row level security;
alter table public.capital_ledger enable row level security;

