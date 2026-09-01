-- ============================================================
-- 009 — Normalize category references to slugs (Phase 5/6 cleanup)
-- Run AFTER 007/008. Idempotent.
-- ============================================================
-- New taxonomy-driven forms store category SLUGS on products and
-- stores; legacy rows stored display labels. This aligns everything
-- on slugs so the sales store-category filter matches consistently.

do $$
begin
  if to_regclass('public.product_categories') is not null then
    -- products.category: "Fragrance" → "fragrance" (only where a matching
    -- category row exists; unmatched free-text values are left alone)
    update public.products p
    set category = c.slug
    from public.product_categories c
    where p.category is not null
      and lower(c.label) = lower(p.category)
      and c.slug <> p.category;

    -- stores.categories text[]: map each label to its slug (unknown
    -- values are kept as-is so nothing is silently dropped)
    update public.stores s
    set categories = array(
      select distinct coalesce(
        (select c.slug from public.product_categories c
          where lower(c.label) = lower(cat)),
        cat
      )
      from unnest(s.categories) as cat
    )
    where s.categories is not null
      and array_length(s.categories, 1) > 0;
  end if;
end $$;
