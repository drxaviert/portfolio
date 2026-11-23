/**
 * The study's credit block, kept outside the prose's paragraph mapper so the
 * exact attribution reads as a separate note rather than another body line.
 */
export function HumanContactCredit() {
  return (
    <aside className="hc-credit-block" aria-label="Credit">
      <p>
        Original design: HUMANCONTACT INC. (
        <a href="https://humancontact.com" rel="noreferrer">
          humancontact.com
        </a>
        ).
      </p>
      <p>
        Hover interaction added by Dat. It was not part of the original
        homepage.
      </p>
    </aside>
  );
}
