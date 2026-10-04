export const inr = (n) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;
export const when = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
export const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
export const label = (s) => String(s || "").replace(/_/g, " ");
export const stars = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
export const kmBetween = (a, b, c, d) => {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};
export const tomorrow = (extra = 1) => new Date(Date.now() + extra * 86400000).toISOString().split("T")[0];
