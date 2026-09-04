"use server";

import { revalidatePath } from "next/cache";
import { requirePrivileged } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProductEditResult = { error?: string; success?: string };

/** Update a product's catalog fields (name, brand, category, retail price,
 *  active toggle). Privileged users only; RLS scopes the row to the tenant. */
export async function updateProductAction(
  _prev: ProductEditResult,
  formData: FormData
): Promise<ProductEditResult> {
  await requirePrivileged();
  const supabase = await createClient();

  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const retailPrice = Number(formData.get("retail_price") ?? 0);
  const isActive = formData.get("is_active") === "on";

  if (!productId) return { error: "Missing product." };
  if (!name) return { error: "Product name is required." };
  if (!Number.isFinite(retailPrice) || retailPrice < 0)
    return { error: "Retail price must be a non-negative number." };

  const { error } = await supabase
    .from("products")
    .update({
      name,
      brand: brand || null,
      category: category || null,
      retail_price: retailPrice,
      is_active: isActive,
    })
    .eq("id", productId);

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/inventory");
  revalidatePath("/sales");
  return { success: `Product "${name}" updated.` };
}
