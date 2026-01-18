import { type ActionFunctionArgs, redirect } from "react-router";
import { useSubmit, useActionData, useNavigation } from "react-router";
import { Button, Card, Layout, Page, Text, BlockStack, Banner } from "@shopify/polaris";
import { authenticate } from "../../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Try to discover the Payment Customization function ID dynamically
  const fnRes = await admin.graphql(
    `#graphql
    query PaymentFunctions {
      shopifyFunctions(first: 25) {
        nodes {
          id
          title
          apiType
        }
      }
    }`
  );
  const fnJson = await fnRes.json();
  const nodes = fnJson?.data?.shopifyFunctions?.nodes || [];

  // Prefer a function with payment customization api type; otherwise fall back to the first one
  // Note: apiType string varies by API version. If your store has only one function, this is safe.
  const paymentFn =
    nodes.find((n: any) =>
      String(n.apiType || "").toUpperCase().includes("PAYMENT")
    ) || nodes[0];

  if (!paymentFn?.id) {
    return {
      errors: [
        {
          message:
            "No Shopify Function found. Please run `shopify app function build` and `shopify app function deploy`, then try again.",
        },
      ],
    };
  }

  const response = await admin.graphql(
    `#graphql
    mutation paymentCustomizationCreate($paymentCustomization: PaymentCustomizationInput!) {
      paymentCustomizationCreate(paymentCustomization: $paymentCustomization) {
        paymentCustomization {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        paymentCustomization: {
          title: "Hide COD by City",
          enabled: true,
          functionId: paymentFn.id,
        },
      },
    }
  );

  const responseJson = await response.json();
  const errors = responseJson.data?.paymentCustomizationCreate?.userErrors;

  if (errors && errors.length > 0) {
    return { errors };
  }

  const id = responseJson.data.paymentCustomizationCreate.paymentCustomization.id;
  return redirect(`/app/payment-customization/hide-cod/${id.split("/").pop()}`);
};

export const loader = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function CreateCustomization() {
  const submit = useSubmit();
  const actionData = useActionData<{ errors?: { message: string }[] }>();
  const navigation = useNavigation();

  const isLoading = navigation.state === "submitting";

  const handleCreate = () => {
    submit({}, { method: "POST" });
  };

  return (
    <Page title="Enable COD Hider">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Enable Payment Customization
              </Text>

              {actionData?.errors && (
                <Banner tone="critical">
                  <p>Error creating rule:</p>
                  <ul>
                    {actionData.errors.map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                  </ul>
                </Banner>
              )}

              <Text as="p">
                Click below to create the rule, then you can configure the cities that should hide COD.
              </Text>

              <Button variant="primary" onClick={handleCreate} loading={isLoading}>
                Add Customization
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}