import type { FunctionRunResult, RunInput } from "../generated/api";

type Config = {
  allowedCities?: string[] | string;
  codKeywords?: string[] | string;
};

const NO_CHANGES: FunctionRunResult = { operations: [] };

function norm(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toStringArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

export function run(input: RunInput): FunctionRunResult {
  const cfg = (input.paymentCustomization?.metafield?.jsonValue ?? {}) as Config;

  const allowedCities = toStringArray(cfg.allowedCities);

  // Default keywords if none provided
  const codKeywords =
    toStringArray(cfg.codKeywords).length > 0
      ? toStringArray(cfg.codKeywords)
      : ["cash on delivery", "cod", "cash"];

  // Get the customer's shipping city
  const groups = input.cart?.deliveryGroups ?? [];
  const rawCity = groups[0]?.deliveryAddress?.city;

  // If city isn't entered or no allowedCities configured, do nothing
  if (!rawCity) return NO_CHANGES;
  if (allowedCities.length === 0) return NO_CHANGES;

  const checkoutCity = norm(rawCity);

  // Show only for allowed cities
  const isAllowed = allowedCities.some((allowed) => {
    const a = norm(allowed);
    return checkoutCity === a || checkoutCity.includes(a) || a.includes(checkoutCity);
  });

  if (isAllowed) return NO_CHANGES;

  // Hide COD if not allowed
  const methods = input.paymentMethods ?? [];
  const codMethods = methods.filter((m) => {
    const name = norm(m.name);
    return codKeywords.some((k) => name.includes(norm(k)));
  });

  if (codMethods.length === 0) return NO_CHANGES;

  return {
    operations: codMethods.map((pm) => ({
      hide: { paymentMethodId: pm.id },
    })),
  };
}