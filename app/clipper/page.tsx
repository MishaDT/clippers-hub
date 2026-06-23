import { redirect } from "next/navigation";

// Merged into the unified /profile (worker view).
export default function ClipperPage() {
  redirect("/profile");
}
