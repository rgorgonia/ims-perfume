-- ============================================================
-- IMS — Fix inventory upsert for SKUs without a batch/lot
-- Run AFTER 001. Safe to re-run.
-- ============================================================
-- PROBLEM: inventory_levels has unique (variant_id, store_id, batch_id)
-- and a check quantity_on_hand >= 0. In PostgreSQL, NULL values are always
-- treated as DISTINCT in unique constraints, so `on conflict
-- (variant_id, store_id, batch_id)` NEVER matches an existing row whose
-- batch_id is NULL (the common no-lot case). A sale therefore tries to
-- INSERT a second row carrying a NEGATIVE quantity -> check-violation ->
-- the whole sale record silently fails.
--
-- FIX: upsert manually with a null-safe key (`is not distinct from`) and
-- raise clear, actionable errors on no-stock / insufficient-stock instead
-- of failing the insert with an opaque constraint violation.
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_qoh int;
begin
  select quantity_on_hand into v_qoh
    from public.inventory_levels
   where variant_id = new.variant_id
     and store_id  = new.store_id
     and batch_id  is not distinct from new.batch_id;

  if v_qoh is null then
    -- No row yet. Only stock-in (non-negative) may create one; a negative
    -- movement means we are trying to deduct from nothing.
    if new.quantity < 0 then
      raise exception 'cannot deduct stock: no stock on hand for variant % at store %',
        new.variant_id, new.store_id;
    end if;
    insert into public.inventory_levels (variant_id, store_id, batch_id, quantity_on_hand)
    values (new.variant_id, new.store_id, new.batch_id, new.quantity);
  else
    if v_qoh + new.quantity < 0 then
      raise exception 'insufficient stock for variant % at store %: have %, needed %',
        new.variant_id, new.store_id, v_qoh, -new.quantity;
    end if;
    update public.inventory_levels
       set quantity_on_hand = quantity_on_hand + new.quantity,
           updated_at       = now()
     where variant_id = new.variant_id
       and store_id  = new.store_id
       and batch_id  is not distinct from new.batch_id;
  end if;
  return new;
end;
$$;