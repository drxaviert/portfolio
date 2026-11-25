import { createContext, useContext } from "react";

/**
 * Increments when the drawer is shown again at rest behind a returning
 * full-screen route. Content that was scrolled while it was hidden waits for
 * the new token before restoring its position: the drawer's own closed pose is
 * still moving until this commit.
 */
export const DrawerRestoreContext = createContext(0);

export function useDrawerRestoreToken(): number {
  return useContext(DrawerRestoreContext);
}
