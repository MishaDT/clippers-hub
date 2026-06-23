import { redirect } from "next/navigation";

// Merged into the unified /profile (client view).
export default function ClientPage() {
  redirect("/profile");
}
