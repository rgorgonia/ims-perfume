import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser, requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, formatMoney } from "@/lib/settings";
import { getTaxonomy } from "@/lib/services/taxonomy";
import { parseVariantAttributes } from "@/lib/attributes";
import CategoryAttributeFields from "@/components/category-attribute-fields";

type Variant = {
  id: string;
  sku: string;
  size_ml: number;
  variant_type: string;
  retail_price: number;
  low_stock_threshold: number;
  attributes: Record<string, string | number | boolean> | null;
};
type Note = { id: string; note_type: string; note_name: string };
type Batch = {
  id: string;
  lot_number: string;
  expires_on: string | null;
  product_variant_id: string;
};

async function addVariant(formData: FormData) {
  "use server";
  const session = await requirePrivileged();
  const productId = String(formData.get("product_id") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const variantType = String(formData.get("variant_type") ?? "retail");
  const retailPrice = Number(formData.get("retail_price") ?? 0);
  const threshold = Number(formData.get("low_stock_threshold") ?? 5);
  if (!productId || !sku) return;

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("category")
    .eq("id", productId)
    .single();

  const taxonomy = await getTaxonomy(session.tenant_id);
  const attributes = parseVariantAttributes(
    formData,
    taxonomy,
    product?.category ?? ""
  );
  // Size is taxonomy-driven (attributes.size); mirrored to the legacy
  // size_ml column when numeric so older reports keep working.
  const size = attributes.size;

  const { error } = await supabase.from("product_variants").insert({
    product_id: productId,
    tenant_id: session.tenant_id,
    sku,
    size_ml: typeof size === "number" ? size : null,
    variant_type: variantType,
    retail_price: retailPrice,
    low_stock_threshold: threshold || 5,
    attributes,
  });
  if (!error) revalidatePath(`/products/${productId}`);
}

async function addNote(formData: FormData) {
  "use server";
  const session = await requirePrivileged();
  const productId = String(formData.get("product_id") ?? "");
  const noteType = String(formData.get("note_type") ?? "").trim();
  const noteName = String(formData.get("note_name") ?? "").trim().toLowerCase();
  if (!productId || !noteType || !noteName) return;

  const supabase = await createClient();
  await supabase.from("product_notes").upsert({
    product_id: productId,
    tenant_id: session.tenant_id,
    note_type: noteType,
    note_name: noteName,
  });
  revalidatePath(`/products/${productId}`);
}

async function removeNote(formData: FormData) {
  "use server";
  await requirePrivileged();
  const productId = String(formData.get("product_id") ?? "");
  const noteId = String(formData.get("note_id") ?? "");
  const supabase = await createClient();
  await supabase.from("product_notes").delete().eq("id", noteId);
  revalidatePath(`/products/${productId}`);
}

async function addBatch(formData: FormData) {
  "use server";
  const session = await requirePrivileged();
  const productId = String(formData.get("product_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const lotNumber = String(formData.get("lot_number") ?? "").trim();
  const expiresOn = String(formData.get("expires_on") ?? "").trim();
  if (!productId || !variantId || !lotNumber) return;

  const supabase = await createClient();
  await supabase.from("batches").upsert(
    {
      product_variant_id: variantId,
      tenant_id: session.tenant_id,
      lot_number: lotNumber,
      expires_on: expiresOn || null,
    },
    { onConflict: "product_variant_id,lot_number" }
  );
  revalidatePath(`/products/${productId}`);
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const supabase = await createClient();
  const [{ currencySymbol, currencyLocale, sizeUnit }, taxonomy, { data: product }, { data: variants }] =
    await Promise.all([
      getSettings(session.tenant_id),
      getTaxonomy(session.tenant_id),
      supabase.from("products").select("*").eq("id", id).single(),
      supabase.from("variant_public_view").select("*").eq("product_id", id),
    ]);
  const money = (n: number) => formatMoney(n, currencySymbol, currencyLocale);
  if (!product) notFound();
  const variantList = (variants ?? []) as unknown as Variant[];

  const [{ data: notes }, { data: batches }] = await Promise.all([
    supabase.from("product_notes").select("*").eq("product_id", id),
    supabase
      .from("batches")
      .select("id, lot_number, expires_on, product_variant_id")
      .in("product_variant_id", variantList.map((v) => v.id)),
  ]);

  const inputCls =
    "rounded-[10px] border border-black/10 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-transparent";
  const noteList = (notes ?? []) as unknown as Note[];
  // Note/tag groups are free-form: any group label already in use, so
  // non-perfume categories can tag items too (e.g. "scent", "material").
  const noteTypes = Array.from(
    new Set([
      ...noteList.map((n) => n.note_type),
      "top",
      "heart",
      "base",
    ])
  );
  const batchList = (batches ?? []) as unknown as Batch[];

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6 sm:py-8">
      <header>
        <Link href="/products" className="text-sm text-neutral-500 hover:underline">
          ← Back to catalog
        </Link>
        <h1 className="text-2xl font-bold">
          {product.name}
          {product.brand ? ` — ${product.brand}` : ""}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {product.category
            ? `${taxonomy.categories.find((c) => c.slug === product.category)?.label ?? product.category} · `
            : ""}
          Retail {money(Number(product.retail_price))}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Variants</h2>
        <ul className="space-y-1 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 text-sm dark:border-neutral-800">
          {variantList.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3">
              <span>
                <Link href="/inventory" className="hover:underline">
                  {v.sku}
                  {v.size_ml != null ? ` — ${v.size_ml}${sizeUnit}` : ""} {v.variant_type}
                </Link>
                {v.attributes &&
                  Object.entries(v.attributes).length > 0 && (
                    <span className="text-neutral-500">
                      {" · "}
                      {Object.entries(v.attributes)
                        .map(([, val]) => String(val))
                        .join(" · ")}
                    </span>
                  )}
              </span>
              <span className="flex items-center gap-3">
                <Link href="/inventory" className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:hover:text-white">
                  Add stock
                </Link>
                <span>{money(Number(v.retail_price))}</span>
              </span>
            </li>
          ))}
        </ul>
        <form action={addVariant} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-3 dark:border-neutral-800">
          <input type="hidden" name="product_id" value={id} />
          <input name="sku" required placeholder="SKU *" className={inputCls} />
          <input name="variant_type" list="variant-types" defaultValue="retail" placeholder="Variant type" className={inputCls} />
          <datalist id="variant-types">
            <option value="retail" />
            <option value="tester" />
            <option value="sample" />
            <option value="bundle" />
            <option value="gift_set" />
          </datalist>
          <input name="retail_price" type="number" step="0.01" min="0" placeholder="Retail price" className={inputCls} />
          <input name="low_stock_threshold" type="number" min="0" placeholder="Low-stock threshold" className={inputCls} />
          <CategoryAttributeFields taxonomy={taxonomy} initialCategory={product.category ?? ""} />
          <button type="submit" className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium hover:opacity-80 sm:col-span-3">
            Add variant
          </button>
        </form>
      </section>

      {(product.category === "fragrance" ||
        (taxonomy.attributesByCategory[product.category ?? ""] ?? []).some(
          (d) => d.attribute_key.includes("note")
        ) ||
        noteList.length > 0) && (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Notes &amp; tags</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {noteTypes.map((type) => (
            <div key={type} className="rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 dark:border-neutral-800">
              <p className="mb-2 text-sm font-medium capitalize">{type}</p>
              <div className="flex flex-wrap gap-2">
                {noteList.filter((n) => n.note_type === type).map((n) => (
                  <form key={n.id} action={removeNote} className="contents">
                    <input type="hidden" name="note_id" value={n.id} />
                    <input type="hidden" name="product_id" value={id} />
                    <button
                      type="submit"
                      title="Remove"
                      className="rounded-2xl bg-neutral-100 px-3 py-1 text-xs hover:bg-red-100 dark:bg-neutral-900 dark:hover:bg-red-950"
                    >
                      {n.note_name} ✕
                    </button>
                  </form>
                ))}
                {noteList.filter((n) => n.note_type === type).length === 0 && (
                  <span className="text-xs text-neutral-500">None</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <form action={addNote} className="flex gap-3">
          <input type="hidden" name="product_id" value={id} />
          <input name="note_type" list="note-types" required placeholder="Group (e.g. top)" className={inputCls} />
          <datalist id="note-types">
            {noteTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <input name="note_name" required placeholder="e.g. bergamot" className={`${inputCls} flex-1`} />
          <button type="submit" className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium hover:opacity-80">
            Add note
          </button>
        </form>
      </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Batches / lots</h2>
        <ul className="space-y-1 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 text-sm dark:border-neutral-800">
          {batchList.map((b) => (
            <li key={b.id} className="flex justify-between">
              <span>
                {b.lot_number}
                <span className="text-neutral-500">
                  {" "}· {variantList.find((v) => v.id === b.product_variant_id)?.sku}
                </span>
              </span>
              <span className={b.expires_on && new Date(b.expires_on) < new Date() ? "text-red-600 dark:text-red-400" : ""}>
                {b.expires_on ? `exp ${b.expires_on}` : "no expiry"}
              </span>
            </li>
          ))}
          {batchList.length === 0 && (
            <li className="text-center text-neutral-500">No batches recorded.</li>
          )}
        </ul>
        <form action={addBatch} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white dark:bg-transparent p-4 sm:grid-cols-2 dark:border-neutral-800">
          <input type="hidden" name="product_id" value={id} />
          <select name="variant_id" required className={inputCls}>
            <option value="">Select variant *</option>
            {variantList.map((v) => (
              <option key={v.id} value={v.id}>{v.sku}</option>
            ))}
          </select>
          <input name="lot_number" required placeholder="Lot number *" className={inputCls} />
          <input name="expires_on" type="date" className={inputCls} aria-label="Expires on" />
          <button type="submit" className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium hover:opacity-80">
            Add batch
          </button>
        </form>
      </section>
    </div>
  );
}


