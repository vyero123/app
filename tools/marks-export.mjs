/* Shared mark geometry, exported so tools/measure can render them in isolation.
   Kept in one place so the comparison, the measurement and the app cannot
   drift apart. */
const SQ = 42;

export function chipMark(side, king) {
  const inset = SQ * 0.19, s = SQ - inset * 2;
  const fill = side === 'w' ? '#f6f1e4' : '#14181f';
  const key = side === 'w' ? '#3a2c16' : '#dfe7ee';
  const kw = side === 'w' ? 1.5 : 2;
  let out = `<rect x="${inset}" y="${inset}" width="${s}" height="${s}" rx="5" fill="${fill}" stroke="${key}" stroke-width="${kw}"/>`;
  if (king) {
    const c = SQ / 2, a = 5.5, t = 3;
    const ink = side === 'w' ? '#2b1d0d' : '#f2ece0';
    out += `<rect x="${c-t/2}" y="${c-a}" width="${t}" height="${a*2}" rx="1" fill="${ink}"/>`;
    out += `<rect x="${c-a}" y="${c-t/2}" width="${a*2}" height="${t}" rx="1" fill="${ink}"/>`;
  }
  return out;
}

export function oxMark(side, king) {
  const c = SQ / 2, INK = '#f7f2e6', KEY = 'rgba(8,6,3,.82)', W = 4.4, KW = 7.8;
  let out = '';
  if (side === 'w') {
    const r = 11.2;
    out += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${KEY}" stroke-width="${KW}"/>`;
    out += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${INK}" stroke-width="${W}"/>`;
  } else {
    const d = 9.6;
    const arms = `M${c-d} ${c-d}L${c+d} ${c+d}M${c+d} ${c-d}L${c-d} ${c+d}`;
    out += `<path d="${arms}" fill="none" stroke="${KEY}" stroke-width="${KW}" stroke-linecap="round"/>`;
    out += `<path d="${arms}" fill="none" stroke="${INK}" stroke-width="${W}" stroke-linecap="round"/>`;
  }
  if (king) {
    // Corner ticks, not a full frame. A frame around the mark was
    // unmistakable but cost two thirds of the square's tint (measured:
    // 33.6% left, against 65-71% for a plain mark) — far too much on the
    // one square you look at most. Four right angles say the same thing
    // for a fifth of the ink, and cannot be read as the selection ring,
    // which is a continuous green edge further out.
    const i = 4, L = 6, T2 = 2.4, e = SQ - i;
    const corners = [
      `M${i} ${i + L}V${i}H${i + L}`,
      `M${e - L} ${i}H${e}V${i + L}`,
      `M${e} ${e - L}V${e}H${e - L}`,
      `M${i + L} ${e}H${i}V${e - L}`,
    ].join('');
    out = `<path d="${corners}" fill="none" stroke="${KEY}" stroke-width="${T2 + 2.6}" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="${corners}" fill="none" stroke="${INK}" stroke-width="${T2}" stroke-linecap="round" stroke-linejoin="round"/>`
        + out;
  }
  return out;
}

/** The ring that shipped before, for comparison. */
export function ringMark(side) {
  const main = side === 'w' ? '#ffffff' : '#04060b';
  const key = side === 'w' ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.75)';
  return `<rect x="3.75" y="3.75" width="34.5" height="34.5" rx="3" fill="none" stroke="${key}" stroke-width="3.5"/>`
       + `<rect x="3" y="3" width="36" height="36" rx="4" fill="none" stroke="${main}" stroke-width="2"/>`;
}
