-- ============================================================
-- Perfume IMS — Row-Level Security Policies
-- Run AFTER 001_schema.sql
-- ============================================================

-- ---------- STORES ----------
create policy stores_read_all on public.stores
  for select using (true);   -- managers need to see store names for context

create policy stores_admin_write on public.stores
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- ---------- PROFILES: admin-only write, self read ----------
create policy profile_admin_write on public.profiles
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy profile_self_read on public.profiles
  for select using (id = auth.uid() or public.is_system_admin());

-- ---------- PRODUCTS & NOTES ----------
create policy products_read on public.products
  for select using (is_active or public.is_system_admin());

create policy products_admin_write on public.products
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy notes_read on public.product_notes
  for select using (true);

create policy notes_admin_write on public.product_notes
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- ---------- PRODUCT VARIANTS ----------
-- Managers may read variant rows (SKU, size, retail price) but the app only ever
-- exposes cost_price via admin server components; the cost column is also hidden
-- behind public.variant_public_view for manager-facing queries.
create policy variants_read on public.product_variants
  for select using (is_active or public.is_system_admin());

create policy variants_admin_write on public.product_variants
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- ---------- BATCHES ----------
create policy batches_read on public.batches
  for select using (true);

create policy batches_admin_write on public.batches
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- ---------- INVENTORY LEVELS: store-isolated ----------
create policy inv_select on public.inventory_levels
  for select using (store_id in (select public.assigned_store_ids()));

-- Managers never update inventory_levels directly; they insert stock_movements.
create policy inv_admin_write on public.inventory_levels
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- ---------- STOCK MOVEMENTS: store-isolated, insert allowed for assigned stores ----------
create policy mov_select on public.stock_movements
  for select using (store_id in (select public.assigned_store_ids()));

create policy mov_insert on public.stock_movements
  for insert with check (store_id in (select public.assigned_store_ids()));

-- ---------- SUPPLIERS ----------
create policy suppliers_read on public.suppliers
  for select using (true);

create policy suppliers_admin_write on public.suppliers
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- ---------- PURCHASE ORDERS: store-isolated ----------
create policy po_select on public.purchase_orders
  for select using (store_id in (select public.assigned_store_ids()));

create policy po_write on public.purchase_orders
  for all using (store_id in (select public.assigned_store_ids()))
  with check (store_id in (select public.assigned_store_ids()));

create policy poi_select on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and po.store_id in (select public.assigned_store_ids())
    )
  );

create policy poi_write on public.purchase_order_items
  for all with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and po.store_id in (select public.assigned_store_ids())
    )
  );

-- ---------- SALES: insert for own store, select own store, admin-only edits ----------
create policy sale_insert on public.sales_transactions
  for insert with check (
    store_id in (select public.assigned_store_ids())
    and sold_by = auth.uid()          -- managers can only record their own sales
  );

create policy sale_select on public.sales_transactions
  for select using (store_id in (select public.assigned_store_ids()));

create policy sale_update_admin on public.sales_transactions
  for update using (public.is_system_admin()) with check (public.is_system_admin());

create policy sale_delete_admin on public.sales_transactions
  for delete using (public.is_system_admin());

create policy sale_item_insert on public.sale_items
  for insert with check (
    exists (
      select 1 from public.sales_transactions s
      where s.id = sale_id
        and s.store_id in (select public.assigned_store_ids())
        and s.sold_by = auth.uid()
    )
  );

create policy sale_item_select on public.sale_items
  for select using (
    exists (
      select 1 from public.sales_transactions s
      where s.id = sale_id
        and s.store_id in (select public.assigned_store_ids())
    )
  );

-- ---------- CAPITAL LEDGER: admin-only (no policy = deny for everyone else) ----------
create policy ledger_admin_all on public.capital_ledger
  for all using (public.is_system_admin()) with check (public.is_system_admin());

-- ---------- SUPABASE REALTIME (optional) ----------
alter publication supabase_realtime add table inventory_levels, stock_movements;
