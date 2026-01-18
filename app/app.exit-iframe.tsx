import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const authUrl = `/api/auth?shop=${encodeURIComponent(shop)}`;
  return { authUrl };
};

export default function ExitIframe() {
  const { authUrl } = useLoaderData<typeof loader>();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.top === window.self) {
        window.location.href = authUrl;
      } else {
        window.top!.location.href = authUrl;
      }
    }
  }, [authUrl]);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      Redirecting to Shopify… If nothing happens, <a href={authUrl}>click here</a>.
    </div>
  );
}