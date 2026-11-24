import type { MDXComponents } from "mdx/types";
import { HumanContactCredit } from "@/components/human-contact/human-contact-credit";
import { HumanContactEmbed } from "@/components/human-contact/human-contact-embed";
import { Media } from "@/components/media/media";
import { BriefQuote, DecisionTable, Note } from "./parts";
import { ContactSheet, Figure, Hero, StepFigure } from "./media-parts";

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
  ul: ({ children }) => <ul className="wd-ul">{children}</ul>,
  ol: ({ children }) => <ol className="wd-ol">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="wd-quote">{children}</blockquote>
  ),
  pre: ({ children }) => <pre className="wd-pre">{children}</pre>,
  code: ({ children }) => <code className="wd-code">{children}</code>,
  strong: ({ children }) => <strong className="wd-strong">{children}</strong>,
  em: ({ children }) => <em className="wd-em">{children}</em>,
  hr: () => <hr className="wd-hr" />,
  Note,
  Figure,
  Hero,
  StepFigure,
  ContactSheet,
  Media,
  Brief: BriefQuote,
  Steps: DecisionTable,
  HumanContactEmbed,
  HumanContactCredit,
};
