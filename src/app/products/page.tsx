import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Variant = { sku: string; size_ml: number; retail_price: number };
type Product = {
  id: string;
  name: string;
  brand: string | null;
  concentration: string;
  retail_price: number;
  is_active: boolean;
  product_variants: Variant[];
};

async function createProduct(formData: FormData) {
  "use server";
  const session = await requireUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const concentration = String(formData.get("concentration") ?? "EDP");
  const retailPrice = Number(formData.get("retail_price") ?? 0);
  const sizeMl = Number(formData.get("size_ml") ?? 0);
  const sku = String(formData.get("sku") ?? "").trim();
  const isAdmin = session.profile?.role === "system_admin";
  const costPrice = isAdmin ? Number(formData.get("cost_price") ?? 0) : 0;

  if (!name || !sku || !sizeMl) return;

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name,
      brand: brand || null,
      concentration,
      cost_price: costPrice,
      retail_price: retailPrice,
    })
    .select("id")
    .single();
  if (error || !product) return;

  await supabase.from("product_variants").insert({
    product_id: product.id,
    sku,
    size_ml: sizeMl,
    cost_price: costPrice,
    retail_price: retailPrice,
  });

  revalidatePath("/products");
}

export default async function ProductsPage() {
  const session = await requireUser();
  const isAdmin = session.profile?.role === "system_admin";
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, brand, concentration, retail_price, is_active, product_variants(sku, size_ml, retail_price)"
    )
    .order("name");

  const inputCls =
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Add product</h1>
        <form
          action={createProduct}
          className="grid gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-3 dark:border-neutral-800"
        >
          <input name="name" required placeholder="Product name *" className={inputCls} />
          <input name="brand" placeholder="Brand" className={inputCls} />
          <select name="concentration" className={inputCls}>
            <option value="EDT">EDT</option>
            <option value="EDP">EDP</option>
            <option value="EXTRAIT">Extrait</option>
            <option value="EDC">EDC</option>
            <option value="OIL">Oil</option>
          </select>
          <input
            name="sku"
            required
            placeholder="SKU for first variant *"
            className={inputCls}
          />
          <input
            name="size_ml"
            required
            type="number"
            min="1"
            placeholder="Size (ml) *"
            className={inputCls}
          />
          <input
            name="retail_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Retail price"
            className={inputCls}
          />
          {isAdmin && (
            <input
              name="cost_price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Cost price (admin)"
              className={inputCls}
            />
          )}
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 sm:col-span-3"
          >
            Create product
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Catalog</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Brand</th>
                <th className="px-4 py-2">Concentration</th>
                <th className="px-4 py-2">Variants</th>
                <th className="px-4 py-2">Retail</th>
              </tr>
            </thead>
            <tbody>
              {((products ?? []) as unknown as Product[]).map((p) => (
                <tr key={p.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2">{p.brand ?? "—"}</td>
                  <td className="px-4 py-2">{p.concentration}</td>
                  <td className="px-4 py-2">
                    {(p.product_variants ?? [])
                      .map((v) => `${v.sku} (${v.size_ml}ml)`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2">{Number(p.retail_price).toFixed(2)}</td>
                </tr>
              ))}
              {(products ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No products yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

