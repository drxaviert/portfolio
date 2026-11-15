import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ModalLayout from "./layout";

const nav = vi.hoisted(() => ({ pathname: "/work/systems-in-motion" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

const mounts: string[] = [];

function Reader() {
  useEffect(() => {
    mounts.push("mount");
  }, []);

  return <p>reader</p>;
}

beforeEach(() => {
  mounts.length = 0;
  nav.pathname = "/work/systems-in-motion";
});

describe("modal layout", () => {
  it("drops the reader when the route leaves, so reopening mounts a fresh one", () => {
    const tree = () => (
      <ModalLayout>
        <Reader />
      </ModalLayout>
    );

    const { rerender, queryByText } = render(tree());
    expect(screen.getByText("reader")).toBeInTheDocument();

    nav.pathname = "/";
    rerender(tree());
    expect(queryByText("reader")).not.toBeInTheDocument();

    nav.pathname = "/work/systems-in-motion";
    rerender(tree());
    expect(screen.getByText("reader")).toBeInTheDocument();
    expect(mounts).toHaveLength(2);
  });
});
