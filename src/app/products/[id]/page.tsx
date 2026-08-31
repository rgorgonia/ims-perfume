import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Variant = {
  id: string;
  sku: string;
  size_ml: number;
  variant_type: string;
  retail_price: number;
  low_stock_threshold: number;
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
  await requireUser();
  const productId = String(formData.get("product_id") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const sizeMl = Number(formData.get("size_ml") ?? 0);
  const variantType = String(formData.get("variant_type") ?? "retail");
  const retailPrice = Number(formData.get("retail_price") ?? 0);
  const threshold = Number(formData.get("low_stock_threshold") ?? 5);
  if (!productId || !sku || !sizeMl) return;

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert({
    product_id: productId,
    sku,
    size_ml: sizeMl,
    variant_type: variantType,
    retail_price: retailPrice,
    low_stock_threshold: threshold || 5,
  });
  if (!error) revalidatePath(`/products/${productId}`);
}

async function addNote(formData: FormData) {
  "use server";
  await requireUser();
  const productId = String(formData.get("product_id") ?? "");
  const noteType = String(formData.get("note_type") ?? "top");
  const noteName = String(formData.get("note_name") ?? "").trim().toLowerCase();
  if (!productId || !noteName) return;

  const supabase = await createClient();
  await supabase.from("product_notes").upsert({
    product_id: productId,
    note_type: noteType,
    note_name: noteName,
  });
  revalidatePath(`/products/${productId}`);
}

async function removeNote(formData: FormData) {
  "use server";
  await requireUser();
  const productId = String(formData.get("product_id") ?? "");
  const noteId = String(formData.get("note_id") ?? "");
  const supabase = await createClient();
  await supabase.from("product_notes").delete().eq("id", noteId);
  revalidatePath(`/products/${productId}`);
}

async function addBatch(formData: FormData) {
  "use server";
  await requireUser();
  const productId = String(formData.get("product_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const lotNumber = String(formData.get("lot_number") ?? "").trim();
  const expiresOn = String(formData.get("expires_on") ?? "").trim();
  if (!productId || !variantId || !lotNumber) return;

  const supabase = await createClient();
  await supabase.from("batches").upsert(
    {
      product_variant_id: variantId,
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
  await requireUser();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (!product) notFound();

  const { data: variants } = await supabase
    .from("variant_public_view")
    .select("*")
    .eq("product_id", id);
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
  const noteTypes: [string, string][] = [
    ["top", "Top notes"],
    ["heart", "Heart notes"],
    ["base", "Base notes"],
  ];
  const noteList = (notes ?? []) as unknown as Note[];
  const batchList = (batches ?? []) as unknown as Batch[];

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header>
        <Link href="/products" className="text-sm text-neutral-500 hover:underline">
          ← Back to catalog
        </Link>
        <h1 className="text-2xl font-bold">
          {product.name}
          {product.brand ? ` — ${product.brand}` : ""}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {product.concentration} · Retail ₱{Number(product.retail_price).toFixed(2)}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Variants</h2>
        <ul className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800">
          {variantList.map((v) => (
            <li key={v.id} className="flex justify-between">
              <span>
                {v.sku} — {v.size_ml}ml {v.variant_type}
              </span>
              <span>₱{Number(v.retail_price).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <form action={addVariant} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-3 dark:border-neutral-800">
          <input type="hidden" name="product_id" value={id} />
          <input name="sku" required placeholder="SKU *" className={inputCls} />
          <input name="size_ml" required type="number" min="1" placeholder="Size (ml) *" className={inputCls} />
          <select name="variant_type" className={inputCls}>
            <option value="retail">Retail</option>
            <option value="tester">Tester</option>
            <option value="sample">Sample</option>
            <option value="gift_set">Gift set</option>
          </select>
          <input name="retail_price" type="number" step="0.01" min="0" placeholder="Retail price" className={inputCls} />
          <input name="low_stock_threshold" type="number" min="0" placeholder="Low-stock threshold" className={inputCls} />
          <button type="submit" className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium hover:opacity-80">
            Add variant
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Scent profile</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {noteTypes.map(([type, label]) => (
            <div key={type} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800">
              <p className="mb-2 text-sm font-medium">{label}</p>
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
          <select name="note_type" className={inputCls}>
            <option value="top">Top</option>
            <option value="heart">Heart</option>
            <option value="base">Base</option>
          </select>
          <input name="note_name" required placeholder="e.g. bergamot" className={`${inputCls} flex-1`} />
          <button type="submit" className="rounded-2xl btn-neon px-4 py-2 text-sm font-medium hover:opacity-80">
            Add note
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Batches / lots</h2>
        <ul className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800">
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
        <form action={addBatch} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 dark:border-neutral-800">
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


