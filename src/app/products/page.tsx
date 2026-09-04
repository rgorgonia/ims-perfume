import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser, requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, formatMoney } from "@/lib/settings";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { getAccessibleStores, getActiveStore } from "@/lib/store-scope";
import { parseVariantAttributes } from "@/lib/attributes";
import AddProductForm from "./add-product-form";

type Variant = {
  id: string;
  sku: string;
  size_ml: number;
  retail_price: number;
  attributes?: Record<string, string | number | boolean> | null;
};
type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  retail_price: number;
  is_active: boolean;
  product_variants: Variant[];
};

export type ProductResult = { error?: string; success?: string };

async function createProduct(
  _prev: ProductResult,
  formData: FormData
): Promise<ProductResult> {
  "use server";
  const session = await requireUser();
  const supabase = await createClient();
  const accessible = await getAccessibleStores(session, supabase);
  const activeStoreId = await getActiveStore(accessible);
  const storeId = activeStoreId
    ? String(formData.get("store_id") ?? "").trim() || activeStoreId
    : null;

  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const retailPrice = Number(formData.get("retail_price") ?? 0);
  const sizeMl = Number(formData.get("size_ml") ?? 0);
  const sku = String(formData.get("sku") ?? "").trim();
  const isPrivileged = session.isPlatformAdmin || session.isTenantOwner;
  const costPrice = isPrivileged ? Number(formData.get("cost_price") ?? 0) : 0;

  if (!name || !sku || !sizeMl)
    return { error: "Product name, SKU and size are required." };

  // Dynamic attributes from the taxonomy-generated fields (JSONB on the variant).
  const taxonomy = await getTaxonomy(session.tenant_id);
  const attributes = parseVariantAttributes(formData, taxonomy, category);

  // ONE atomic RPC (migration 013): product + first variant in a single
  // transaction, so a duplicate-SKU failure can never leave an orphan
  // product that is invisible to Inventory/Sales.
  const { data: created, error } = await supabase.rpc(
    "create_product_with_variant",
    {
      p_name: name,
      p_brand: brand || null,
      p_category: category || null,
      p_attributes: attributes,
      p_sku: sku,
      p_size_ml: sizeMl,
      p_retail_price: retailPrice,
      p_cost_price: isPrivileged ? costPrice : null,
      p_store_id: storeId,
    }
  );
  if (error || !created)
    return { error: error?.message ?? "Could not create the product." };

  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/sales");
  return { success: `Product "${name}" created with its first variant.` };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await requirePrivileged();
  const isPrivileged = session.isPlatformAdmin || session.isTenantOwner;
  const supabase = await createClient();
  const { category } = await searchParams;
  // Respect the globally selected store (cookie): when a single store is
  // active, availability and currency/size unit reflect only that store.
  const accessible = await getAccessibleStores(session, supabase);
  const activeStoreId = await getActiveStore(accessible);
  const [
    { currencySymbol, currencyLocale, sizeUnit },
    taxonomy,
    { data: products },
    { data: inventory },
  ] = await Promise.all([
    getSettings(session.tenant_id, activeStoreId),
    getTaxonomy(session.tenant_id),
    (() => {
      // Catalog isolation: a selected store shows only its own products; "All
      // stores" shows every product across the caller's stores.
      const q = supabase
        .from("products")
        .select(
          "id, name, brand, category, retail_price, is_active, product_variants(id, sku, size_ml, retail_price, attributes)"
        )
        .order("name");
      if (activeStoreId) q.eq("store_id", activeStoreId);
      if (category) q.eq("category", category);
      return q;
    })(),
    // RLS-scoped: admins see all stores, managers only their own.
    supabase.from("inventory_levels").select("variant_id, store_id, quantity_on_hand"),
  ]);
  const money = (n: number) => formatMoney(n, currencySymbol, currencyLocale);

  // Sum total units on hand per variant (across the caller's visible stores).
  const availByVariant = new Map<string, number>();
  for (const row of (inventory ?? []) as {
    variant_id: string;
    store_id: string;
    quantity_on_hand: number;
  }[]) {
    if (activeStoreId && row.store_id !== activeStoreId) continue;
    availByVariant.set(
      row.variant_id,
      (availByVariant.get(row.variant_id) ?? 0) + Number(row.quantity_on_hand)
    );
  }

  // Total available across all of a product's variants.
  const totalAvail = (p: Product) =>
    (p.product_variants ?? []).reduce(
      (sum, v) => sum + (availByVariant.get(v.id) ?? 0),
      0
    );

  // Distinct attribute values across a product's variants (data-driven
  // "contents" — no hardcoded domain fields like concentration).
  const productAttributes = (p: Product) => {
    const out = new Set<string>();
    for (const v of p.product_variants ?? []) {
      for (const value of Object.values(v.attributes ?? {})) {
        if (value !== "" && value != null) out.add(String(value));
      }
    }
    return [...out];
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-8">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Add product</h1>
        <AddProductForm
          action={createProduct}
          taxonomy={taxonomy}
          sizeUnit={sizeUnit}
          isAdmin={isPrivileged}
          activeStoreId={activeStoreId}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Catalog
          {activeStoreId && (
            <span className="ml-3 align-middle inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              availability for {accessible.find((s) => s.id === activeStoreId)?.name}
            </span>
          )}
        </h2>
        {((products ?? []) as unknown as Product[]).length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-10 text-neutral-500 dark:border-neutral-800 dark:bg-transparent">
            No products yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:bg-transparent dark:border-neutral-800 dark:bg-transparent">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Brand</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Attributes</th>
                  <th className="px-4 py-2">Variants</th>
                  <th className="px-4 py-2">Available</th>
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
                    <td className="px-4 py-2">
                      {productAttributes(p).length ? productAttributes(p).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {(p.product_variants ?? []).length === 0 ? (
                        <Link
                          href={`/products/${p.id}`}
                          className="text-amber-600 underline decoration-dotted underline-offset-2 hover:text-amber-700 dark:text-amber-400"
                        >
                          No variant yet — add one
                        </Link>
                      ) : (
                        (p.product_variants ?? [])
                          .map(
                            (v) =>
                              `${v.sku} (${v.size_ml}${sizeUnit}) · ${
                                availByVariant.get(v.id) ?? 0
                              } left`
                          )
                          .join(", ")
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          totalAvail(p) <= 0
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : totalAvail(p) <= 5
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        }`}
                      >
                        {totalAvail(p)}
                      </span>
                    </td>
                    <td className="px-4 py-2">{money(Number(p.retail_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

