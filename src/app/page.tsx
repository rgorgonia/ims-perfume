import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getSettings, formatMoney } from "@/lib/settings";
import { getAccessibleStores, getActiveStore } from "@/lib/store-scope";
import FadeIn from "@/components/fade-in";
import Ticker from "@/components/ticker";

type InvRow = {
  quantity_on_hand: number;
  store_id: string;
  product_variants: {
    sku: string;
    low_stock_threshold: number;
    products: { name: string } | null;
  } | null;
};
type Sale = {
  id: string;
  total: number;
  created_at: string;
  stores: { name: string } | null;
};

export default async function Dashboard() {
  const session = await requireUser();
  const supabase = await createClient();
  const isPrivileged = session.isPlatformAdmin || session.isTenantOwner;
  // Store managers don't see revenue/profit/capital; owners & platform admins do.
  const canSeeRevenue = isPrivileged;

  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  // Respect the globally selected store (cookie): when one store is active,
  // the dashboard aggregates only that store so contents never mix.
  const accessible = await getAccessibleStores(session, supabase);
  const activeStoreId = await getActiveStore(accessible);
  const { currencySymbol, currencyLocale } = await getSettings(session.tenant_id, activeStoreId);
  const peso = (n: number) => formatMoney(n, currencySymbol, currencyLocale);

  // All independent queries run in ONE parallel round-trip batch.
  // The RPC aggregates every RLS-visible store in a single DB call.
  const [summaryRes, invRes, salesRes, capitalRes, salesCountRes] = await Promise.all([
    canSeeRevenue
      ? supabase.rpc("store_sales_summary_all", { p_days: 30 })
      : Promise.resolve({ data: null } as { data: unknown[] | null }),
    supabase.from("inventory_levels").select(
      "quantity_on_hand, store_id, product_variants(sku, low_stock_threshold, products(name))"
    ),
    (() => {
      let q = supabase
        .from("sales_transactions")
        .select("id, total, created_at, stores(name)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (activeStoreId) q = q.eq("store_id", activeStoreId);
      return q;
    })(),
    isPrivileged
      ? (() => {
          let q = supabase.from("capital_ledger").select("amount");
          // Scoped to the selected store when one is active (its per-store
          // entries only, never another store's or another tenant's).
          if (activeStoreId) q = q.eq("store_id", activeStoreId);
          return q;
        })()
      : Promise.resolve({ data: null } as { data: { amount: number }[] | null }),
    canSeeRevenue
      ? Promise.resolve({ count: null as number | null })
      : (() => {
          let q = supabase
            .from("sales_transactions")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since30d);
          if (activeStoreId) q = q.eq("store_id", activeStoreId);
          return q;
        })(),
  ]);

  type AllRow = {
    store_id: string;
    store_name: string;
    day: string;
    revenue: number;
    profit: number;
  };
  const allRows = (summaryRes.data ?? []) as unknown as AllRow[];

  // Fold per-store per-day rows into store totals + a merged 14-day series
  const storeMap = new Map<
    string,
    { id: string; name: string; revenue: number; profit: number }
  >();
  const byDay = new Map<string, number>();
  for (const r of allRows) {
    if (activeStoreId && r.store_id !== activeStoreId) continue;
    const st =
      storeMap.get(r.store_id) ??
      { id: r.store_id, name: r.store_name, revenue: 0, profit: 0 };
    st.revenue += Number(r.revenue);
    st.profit += Number(r.profit);
    storeMap.set(r.store_id, st);
    const day = String(r.day).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(r.revenue));
  }
  const summaries = [...storeMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  // Zero-filled last-14-days series (days with no sales still get a slot)
  const chart: [string, number][] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    chart.push([key, byDay.get(key) ?? 0]);
  }
  const maxDay = Math.max(...chart.map(([, v]) => v), 1);

  // Low stock: quantity at/below each variant's threshold
  const lowStock = ((invRes.data ?? []) as unknown as InvRow[])
    .filter(
      (r) =>
        r.product_variants &&
        (!activeStoreId || r.store_id === activeStoreId) &&
        r.quantity_on_hand <= r.product_variants.low_stock_threshold
    )
    .slice(0, 8);

  const sales = (salesRes.data ?? []) as unknown as Sale[];
  // Admin-only: capital ledger is invisible to managers via RLS
  const capital =
    capitalRes.data === null
      ? null
      : (capitalRes.data as { amount: number }[]).reduce(
          (a, r) => a + Number(r.amount),
          0
        );

  const totalRevenue = summaries.reduce((a, s) => a + s.revenue, 0);
  const totalProfit = summaries.reduce((a, s) => a + s.profit, 0);

  const statCls =
    "card-lift soft rounded-[18px] border border-neutral-200 p-5 dark:border-white/5";

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {session.profile?.full_name ?? "there"}
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {isPrivileged
              ? activeStoreId
                ? `Store overview: ${accessible.find((s) => s.id === activeStoreId)?.name} — last 30 days`
                : "Business overview — last 30 days"
              : "Your store — last 30 days"}
          </p>
        </div>
      </header>

      {/* Stat cards */}
      <FadeIn delay={0.1}>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canSeeRevenue ? (
          <>
            <div className={statCls}>
              <p className="text-xs text-neutral-500">Revenue (30d)</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white"><Ticker value={totalRevenue} currencySymbol={currencySymbol} currencyLocale={currencyLocale} /></p>
            </div>
            <div className={statCls}>
              <p className="text-xs text-neutral-500">Gross profit (30d)</p>
              <p className="text-xl font-bold">{peso(totalProfit)}</p>
            </div>
          </>
        ) : (
          <div className={statCls}>
            <p className="text-xs text-neutral-500">Sales recorded (30d)</p>
            <p className="text-xl font-bold">{salesCountRes.count ?? 0}</p>
          </div>
        )}
        <div className={statCls}>
          <p className="text-xs text-neutral-500">Low-stock items</p>
          <p className="text-xl font-bold">{lowStock.length}</p>
        </div>
        {isPrivileged ? (
          <div className={statCls}>
            <p className="text-xs text-neutral-500">Capital position</p>
            <p className="text-xl font-bold">
              {capital === null ? "—" : peso(capital)}
            </p>
          </div>
        ) : (
          <div className={statCls}>
            <p className="text-xs text-neutral-500">{canSeeRevenue ? "Stores visible" : "Recent sales"}</p>
            <p className="text-xl font-bold">{canSeeRevenue ? summaries.length : (sales ?? []).length}</p>
          </div>
        )}
      </section>
      </FadeIn>

      {/* Daily revenue chart — revenue viewers only */}
      {canSeeRevenue && (
        <FadeIn delay={0.2}>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Daily revenue (last 14 days)</h2>
          <div className="card-lift soft rounded-[18px] border border-neutral-200 p-5 dark:border-white/5">
            {chart.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                No sales in the last 30 days.
              </p>
            ) : (
              <div className="flex h-36 items-end gap-1.5">
                {chart.map(([day, revenue]) => (
                  <div
                    key={day}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
                    title={`${day}: ${peso(revenue)}`}
                  >
                    <div
                      className="w-full rounded-t-[3px] bg-foreground/70 transition-colors group-hover:bg-foreground"
                      style={{ height: `${revenue > 0 ? Math.max((revenue / maxDay) * 100, 4) : 2}%` }}
                    />
                    <span className="text-[9px] text-neutral-400">
                      {day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        </FadeIn>
      )}

      {/* Per-store performance — revenue viewers only */}
      {canSeeRevenue && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Store performance (30 days)</h2>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2">Store</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                  <th className="px-4 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-right">{peso(s.revenue)}</td>
                    <td className="px-4 py-2 text-right">{peso(s.profit)}</td>
                    <td className="px-4 py-2 text-right">
                      {s.revenue > 0
                        ? `${((s.profit / s.revenue) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
                {summaries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                      No stores yet{isPrivileged ? " — add one under Stores." : "."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <FadeIn delay={0.4}>
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Low stock */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Low stock</h2>
          <ul className="space-y-2 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 text-sm dark:border-neutral-800">
            {lowStock.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-4">
                <span>
                  {r.product_variants?.products?.name ?? "Unknown"}{" "}
                  <span className="text-neutral-500">
                    ({r.product_variants?.sku})
                  </span>
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {r.quantity_on_hand} left
                </span>
              </li>
            ))}
            {lowStock.length === 0 && (
              <li className="text-center text-neutral-500">
                Nothing low on stock. 🎉
              </li>
            )}
          </ul>
        </section>

        {/* Recent sales */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recent sales</h2>
          <ul className="space-y-2 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 text-sm dark:border-neutral-800">
            {((sales ?? []) as unknown as Sale[]).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4">
                <span className="text-neutral-600 dark:text-neutral-400">
                  {new Date(s.created_at).toLocaleDateString()} ·{" "}
                  {s.stores?.name ?? "—"}
                </span>
                <span className="font-medium">{peso(s.total)}</span>
              </li>
            ))}
            {(sales ?? []).length === 0 && (
              <li className="text-center text-neutral-500">No sales yet.</li>
            )}
          </ul>
        </section>
      </div>
      </FadeIn>
    </div>
  );
}


