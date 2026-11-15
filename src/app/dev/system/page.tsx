import { redirect } from "next/navigation";

/**
 * The dev token preview has become the public design-system page. Keep the old
 * URL working for existing links and bookmarks.
 */
export default function SystemPage() {
  redirect("/design-system");
}
