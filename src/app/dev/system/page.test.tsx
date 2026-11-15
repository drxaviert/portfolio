import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

import SystemPage from "@/app/dev/system/page";

describe("dev system route", () => {
  it("redirects to the public design-system route", () => {
    SystemPage();

    expect(redirect).toHaveBeenCalledWith("/design-system");
  });
});
