export const usd = (n: number | string | null | undefined, digits = 2) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const num = (n: number | string | null | undefined, digits = 2) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const short = (addr: string, l = 6, r = 4) =>
  addr.length > l + r + 3 ? `${addr.slice(0, l)}…${addr.slice(-r)}` : addr;
