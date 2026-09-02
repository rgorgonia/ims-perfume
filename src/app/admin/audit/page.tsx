import { requirePlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Movement = {
  id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  created_by: string | null;
  tenants: { name: string } | null;
  stores: { name: string } | null;
  product_variants: { sku: string; products: { name: string } | null } | null;
};

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePlatformAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam ?? "1") || 1, 1);
  const supabase = await createClient();

  const from = (page - 1) * PAGE_SIZE;
  const [{ data: movements, count }, { data: profileNames }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select(
        "id, movement_type, quantity, created_at, created_by, tenants(name), stores(name), product_variants(sku, products(name))",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const nameById = new Map(
    (profileNames ?? []).map((p) => [p.id, p.full_name] as const)
  );

  const total = count ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const rows = (movements ?? []) as unknown as Movement[];

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Platform audit log</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Every stock movement across all tenants — event-sourced and immutable.
          Sales deductions are recorded automatically by the database triggers.
        </p>
      </section>

      <section className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-slate-400">
            No stock movements recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-transparent">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Tenant</th>
                  <th className="px-4 py-2">Store</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-500 dark:text-slate-400">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{m.tenants?.name ?? "—"}</td>
                    <td className="px-4 py-2">{m.stores?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      {m.product_variants?.products?.name ?? "—"}
                      <span className="block text-xs text-neutral-400">
                        {m.product_variants?.sku ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.movement_type === "purchase"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                            : m.movement_type === "wastage"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                              : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-slate-300"
                        }`}
                      >
                        {m.movement_type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-medium ${
                        m.quantity < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-4 py-2 text-neutral-500 dark:text-slate-400">
                      {m.created_by ? (nameById.get(m.created_by) ?? "unknown user") : "system"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-slate-400">
          <span>
            {total === 0 ? "0 movements" : `Movements ${from + 1}–${Math.min(from + PAGE_SIZE, total)} of ${total}`}
          </span>
          <span className="flex gap-2">
            {page > 1 && (
              <a
                href={`/admin/audit?page=${page - 1}`}
                className="rounded-full border border-neutral-300 px-3 py-1 hover:bg-black/[0.04] dark:border-neutral-700 dark:hover:bg-white/10"
              >
                ← Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/admin/audit?page=${page + 1}`}
                className="rounded-full border border-neutral-300 px-3 py-1 hover:bg-black/[0.04] dark:border-neutral-700 dark:hover:bg-white/10"
              >
                Next →
              </a>
            )}
          </span>
        </div>
      </section>
    </div>
  );
}
