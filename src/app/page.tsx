import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type SummaryRow = { day: string; revenue: number; cogs: number; profit: number };
type Store = { id: string; name: string };
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

const peso = (n: number) =>
  `₱${Number(n ?? 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

export default async function Dashboard() {
  const session = await requireUser();
  const supabase = await createClient();
  const isAdmin = session.profile?.role === "system_admin";

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .order("name");

  const visibleStores = (stores ?? []) as Store[];

  // One RPC round-trip per store (database does the math — see ARCHITECTURE.md §3)
  const summaries = await Promise.all(
    visibleStores.map(async (s) => {
      const { data } = await supabase.rpc("store_sales_summary", {
        p_store: s.id,
        p_days: 30,
      });
      const rows = (data ?? []) as SummaryRow[];
      return {
        store: s,
        rows,
        revenue: rows.reduce((a, r) => a + Number(r.revenue), 0),
        profit: rows.reduce((a, r) => a + Number(r.profit), 0),
      };
    })
  );

  // Low stock: quantity at/below each variant's threshold (filtered in app —
  // the threshold lives on the variant, not the level row)
  const { data: inv } = await supabase
    .from("inventory_levels")
    .select(
      "quantity_on_hand, store_id, product_variants(sku, low_stock_threshold, products(name))"
    );
  const lowStock = ((inv ?? []) as unknown as InvRow[])
    .filter(
      (r) =>
        r.product_variants &&
        r.quantity_on_hand <= r.product_variants.low_stock_threshold
    )
    .slice(0, 8);

  const { data: sales } = await supabase
    .from("sales_transactions")
    .select("id, total, created_at, stores(name)")
    .order("created_at", { ascending: false })
    .limit(8);

  // Admin-only: capital ledger is invisible to managers via RLS
  let capital: number | null = null;
  if (isAdmin) {
    const { data } = await supabase
      .from("capital_ledger")
      .select("amount");
    capital = (data ?? []).reduce((a, r) => a + Number(r.amount), 0);
  }

  const totalRevenue = summaries.reduce((a, s) => a + s.revenue, 0);
  const totalProfit = summaries.reduce((a, s) => a + s.profit, 0);

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const statCls =
    "rounded-xl border border-neutral-200 p-4 dark:border-neutral-800";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {session.profile?.full_name ?? "there"}
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {isAdmin ? "Business overview — last 30 days" : "Your store — last 30 days"}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:opacity-70 dark:border-neutral-700"
          >
            Sign out
          </button>
        </form>
      </header>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={statCls}>
          <p className="text-xs text-neutral-500">Revenue (30d)</p>
          <p className="text-xl font-bold">{peso(totalRevenue)}</p>
        </div>
        <div className={statCls}>
          <p className="text-xs text-neutral-500">Gross profit (30d)</p>
          <p className="text-xl font-bold">{peso(totalProfit)}</p>
        </div>
        <div className={statCls}>
          <p className="text-xs text-neutral-500">Low-stock items</p>
          <p className="text-xl font-bold">{lowStock.length}</p>
        </div>
        {isAdmin ? (
          <div className={statCls}>
            <p className="text-xs text-neutral-500">Capital position</p>
            <p className="text-xl font-bold">
              {capital === null ? "—" : peso(capital)}
            </p>
          </div>
        ) : (
          <div className={statCls}>
            <p className="text-xs text-neutral-500">Stores visible</p>
            <p className="text-xl font-bold">{visibleStores.length}</p>
          </div>
        )}
      </section>

      {/* Per-store performance */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Store performance (30 days)</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
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
                <tr key={s.store.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">{s.store.name}</td>
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
                    No stores yet{isAdmin ? " — add one under Stores." : "."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Low stock */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Low stock</h2>
          <ul className="space-y-2 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
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
          <ul className="space-y-2 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
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
    </div>
  );
}


