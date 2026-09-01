-- ============================================================
-- IMS — Per-store category assignment
-- Run AFTER 001–005. Safe to re-run.
-- ============================================================
-- NULL or empty array = store sells ALL categories (default behaviour).
alter table public.stores add column if not exists categories text[];