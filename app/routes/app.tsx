import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Outlet, Link, useLocation } from "react-router";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <ShopifyAppProvider apiKey={apiKey} isEmbeddedApp>
      <PolarisProvider i18n={polarisTranslations} linkComponent={LinkAdapter}>
        <Outlet />
      </PolarisProvider>
    </ShopifyAppProvider>
  );
}

// Helper to make Polaris buttons/links work with React Router
// and preserve ?shop and ?host so embedded auth doesn't break.
function LinkAdapter({ children, url, ...rest }: any) {
  // External link? open normally in a new tab
  const isExternal = url && (url.startsWith("http") || url.startsWith("//"));
  if (isExternal) {
    return (
      <a href={url} {...rest} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  // Internal link: preserve ?shop and ?host from current location
  const location = useLocation();
  const currentParams = new URLSearchParams(location.search);
  const shop = currentParams.get("shop");
  const host = currentParams.get("host");

  let to = url || "/";
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://example.com";
    const u = new URL(url || "/", origin);

    if (shop && !u.searchParams.has("shop")) u.searchParams.set("shop", shop);
    if (host && !u.searchParams.has("host")) u.searchParams.set("host", host);

    to = `${u.pathname}${u.search}${u.hash}`;
  } catch {
    // Fallback: append params naïvely if URL constructor fails
    const qs: string[] = [];
    if (shop) qs.push(`shop=${encodeURIComponent(shop)}`);
    if (host) qs.push(`host=${encodeURIComponent(host)}`);
    if (qs.length) {
      to = (url || "/") + ((url || "/").includes("?") ? "&" : "?") + qs.join("&");
    }
  }

  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
}