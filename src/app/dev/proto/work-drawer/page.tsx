import { notFound } from "next/navigation";
import { DrawerProto } from "./drawer-proto";

/**
 * Throwaway prototype: the home work row with three ways of opening a full
 * case-study reader (sheet, card expand, side panel).
 *
 * Dev-only; deep links 404 in a production build.
 */
export const metadata = {
  title: "Prototype · work drawer",
  robots: { index: false, follow: false },
};

export default function WorkDrawerPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DrawerProto />;
}
