import { type LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Badge,
  Banner,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(
      `query {
        paymentCustomizations(first: 10) {
          edges {
            node {
              id
              title
              enabled
            }
          }
        }
      }`
    );

    const responseJson = await response.json();
    const edges = responseJson.data?.paymentCustomizations?.edges || [];
    const customizations = edges.map((edge: any) => edge.node);

    return { customizations };
  } catch (e) {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop") || "";
    return redirect(`/app/exit-iframe?shop=${encodeURIComponent(shop)}`);
  }
};

export default function Index() {
  const { customizations } = useLoaderData<typeof loader>();

  return (
    <Page title="COD City Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text as="h2" variant="headingMd">
                Active City Rules
              </Text>

              {customizations.length === 0 ? (
                <Banner tone="info">
                  <p>You haven't created any rules yet.</p>
                </Banner>
              ) : (
                <BlockStack gap="200">
                  {customizations.map((rule: any) => (
                    <Card key={rule.id}>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingSm">{rule.title}</Text>
                          <div>
                            {rule.enabled ? (
                              <Badge tone="success">Active</Badge>
                            ) : (
                              <Badge>Inactive</Badge>
                            )}
                          </div>
                        </BlockStack>
                        <Button
                          variant="plain"
                          url={`/app/payment-customization/hide-cod/${rule.id.split('/').pop()}`}
                        >
                          Edit Cities
                        </Button>
                      </InlineStack>
                    </Card>
                  ))}
                </BlockStack>
              )}

              <InlineStack align="end">
                <Button variant="primary" url="/app/payment-customization/hide-cod/new">
                  Create New Rule
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}