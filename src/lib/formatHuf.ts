/** Hungarian Forint display: space-separated thousands, comma decimals, " Ft" suffix. */
export function formatHufAmount(n: number): string {
  if (!Number.isFinite(n)) return "";
  const [intRaw, decRaw] = n.toFixed(2).split(".");
  const negative = intRaw.startsWith("-");
  const intDigits = negative ? intRaw.slice(1) : intRaw;
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  let body = (negative ? "-" : "") + grouped;
  if (decRaw !== "00") {
    const dec = decRaw.replace(/0+$/, "") || "0";
    body += `,${dec}`;
  }
  return `${body} Ft`;
}
