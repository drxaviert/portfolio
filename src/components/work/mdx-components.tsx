import type { MDXComponents } from "mdx/types";
import { BriefQuote, DecisionTable, Figure, Hero, Note } from "./parts";

/**
 * The Margin layout's MDX contract. Passed explicitly to the loaded body in
 * `app/work/[slug]/page.tsx`; the root `mdx-components.tsx` stays empty.
 */
export const mdxComponents: MDXComponents = {
  h2: ({ children }) => <h2 className="wd-h2">{children}</h2>,
  p: ({ children }) => <p className="wd-p">{children}</p>,
  a: ({ href, children }) => (
    <a className="wd-link" href={href}>
      {children}
    </a>
  ),
  Note,
  Figure,
  Brief: BriefQuote,
  Steps: DecisionTable,
  Hero,
};
