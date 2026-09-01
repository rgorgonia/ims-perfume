import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, formatMoney } from "@/lib/settings";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { parseVariantAttributes } from "@/lib/attributes";
import CategoryAttributeFields from "@/components/category-attribute-fields";

type Variant = {
  sku: string;
  size_ml: number;
  retail_price: number;
};
type Product = {
  id: string;
  name: string;
  brand: string | null;
  concentration: string | null;
  category: string | null;
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
  const category = String(formData.get("category") ?? "").trim();
  const retailPrice = Number(formData.get("retail_price") ?? 0);
  const sizeMl = Number(formData.get("size_ml") ?? 0);
  const sku = String(formData.get("sku") ?? "").trim();
  const isAdmin = session.profile?.role === "system_admin";
  const costPrice = isAdmin ? Number(formData.get("cost_price") ?? 0) : 0;

  if (!name || !sku || !sizeMl) return;

  // Dynamic attributes from the taxonomy-generated fields (JSONB on the variant).
  const taxonomy = await getTaxonomy();
  const attributes = parseVariantAttributes(formData, taxonomy, category);

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name,
      brand: brand || null,
      category: category || null,
      // Dual-write legacy column while the transition is in progress
      ...(typeof attributes.concentration === "string"
        ? { concentration: attributes.concentration }
        : {}),
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
    attributes,
  });

  revalidatePath("/products");
}

export default async function ProductsPage() {
  const session = await requireUser();
  const isAdmin = session.profile?.role === "system_admin";
  const supabase = await createClient();
  const { currencySymbol, currencyLocale, sizeUnit } = await getSettings();
  const taxonomy = await getTaxonomy();
  const money = (n: number) => formatMoney(n, currencySymbol, currencyLocale);

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, brand, concentration, category, retail_price, is_active, product_variants(sku, size_ml, retail_price)"
    )
    .order("name");

  const inputCls =
    "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Add product</h1>
        <form
          action={createProduct}
          className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-3 dark:border-neutral-800"
        >
          <input name="name" required placeholder="Product name *" className={inputCls} />
          <input name="brand" placeholder="Brand" className={inputCls} />
          <CategoryAttributeFields taxonomy={taxonomy} />
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
            placeholder={`Size (${sizeUnit}) *`}
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
            className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 sm:col-span-3"
          >
            Create product
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Catalog</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Brand</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Concentration</th>
                <th className="px-4 py-2">Variants</th>
                <th className="px-4 py-2">Retail</th>
              </tr>
            </thead>
            <tbody>
              {((products ?? []) as unknown as Product[]).map((p) => (
                <tr key={p.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/products/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{p.brand ?? "—"}</td>
                  <td className="px-4 py-2">
                    {taxonomy.categories.find((c) => c.slug === p.category)?.label ??
                      p.category ??
                      "—"}
                  </td>
                  <td className="px-4 py-2">{p.concentration ?? "—"}</td>
                  <td className="px-4 py-2">
                    {(p.product_variants ?? [])
                      .map((v) => `${v.sku} (${v.size_ml}${sizeUnit})`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2">{money(Number(p.retail_price))}</td>
                </tr>
              ))}
              {(products ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
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

