/**
 * One nav item's geometry and type, shared by the home nav and the drawer's
 * breadcrumb so the two cannot drift. The `nav-item` class carries the
 * hover/current colour, press scale and focus-visible ring (nav-items.css).
 */
export const NAV_ITEM_CLASS = [
  "nav-item relative flex h-8 min-w-0 items-center rounded-md px-2",
  "text-base leading-5 font-medium whitespace-nowrap",
  "outline-hidden focus-visible:outline-solid focus-visible:outline-2",
  "focus-visible:outline-offset-0 focus-visible:outline-primary",
].join(" ");
