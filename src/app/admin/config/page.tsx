import { redirect } from "next/navigation";

// Configuration now lives inside the Stores tab.
export default function AdminConfigPage() {
  redirect("/stores?tab=config");
}
