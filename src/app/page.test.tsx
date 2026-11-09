import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";

describe("home page", () => {
  it("renders the site name placeholder", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { name: "Portfolio" }),
    ).toBeInTheDocument();
  });
});
