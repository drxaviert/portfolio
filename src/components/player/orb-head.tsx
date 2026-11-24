/**
 * The 36px orb mark: the phase gradient with its two matte eyes. It stays the
 * nav's Home link; the satellite control lives beside it.
 */
export function OrbHead() {
  return (
    <span className="orb-head">
      <span className="orb-eyes" aria-hidden="true">
        <span />
        <span />
      </span>
    </span>
  );
}
