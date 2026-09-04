/** Cookie key holding the globally selected store ("all" for every store).
 *  Lives in its own client-safe module so client components (StoreSwitcher)
 *  can reference it without pulling `next/headers` into the browser bundle. */
export const ACTIVE_STORE_COOKIE = "ims_active_store";
