import { useMemo, useState } from "react";
import { type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Autocomplete,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Tag,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";

// 1) Loader: read config (allowedCities) from metafield, with top-level auth bounce if needed
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const customizationId = `gid://shopify/PaymentCustomization/${params.id}`;

    const response = await admin.graphql(
      `#graphql
      query getCustomization($id: ID!) {
        paymentCustomization(id: $id) {
          id
          title
          enabled
          metafield(namespace: "$app:hide-cod", key: "function-configuration") {
            type
            value
            jsonValue
          }
        }
      }`,
      { variables: { id: customizationId } }
    );

    const responseJson = await response.json();
    const mf = responseJson?.data?.paymentCustomization?.metafield;

    let config: any = { allowedCities: [] };
    if (mf?.jsonValue != null) {
      config = mf.jsonValue;
    } else if (mf?.value) {
      try {
        config = JSON.parse(mf.value);
      } catch {
        // ignore parse errors
      }
    }

    if (!Array.isArray(config.allowedCities)) config.allowedCities = [];
    return { config };
  } catch (e) {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop") || "";
    return redirect(`/app/exit-iframe?shop=${encodeURIComponent(shop)}`);
  }
};

// 2) Action: write allowedCities back to metafield (json)
export const action = async ({ request, params }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    let allowedCities: string[] = [];

    const allowedCitiesJson = formData.get("allowedCitiesJson") as string | null;
    if (allowedCitiesJson) {
      try {
        const parsed = JSON.parse(allowedCitiesJson);
        if (Array.isArray(parsed)) {
          allowedCities = parsed.map((c) => String(c).trim()).filter(Boolean);
        }
      } catch {
        // fall through to CSV parsing if JSON fails
      }
    }

    if (allowedCities.length === 0) {
      const csv = (formData.get("allowedCities") as string) || "";
      allowedCities = csv.split(",").map((c) => c.trim()).filter(Boolean);
    }

    const customizationId = `gid://shopify/PaymentCustomization/${params.id}`;

    const response = await admin.graphql(
      `#graphql
      mutation updateCustomization($id: ID!, $metafield: MetafieldInput!) {
        paymentCustomizationUpdate(
          id: $id,
          paymentCustomization: { metafields: [$metafield] }
        ) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          id: customizationId,
          metafield: {
            namespace: "$app:hide-cod",
            key: "function-configuration",
            type: "json",
            value: JSON.stringify({ allowedCities }),
          },
        },
      }
    );

    const json = await response.json();
    const userErrors = json?.data?.paymentCustomizationUpdate?.userErrors || [];
    if (userErrors.length) {
      return { status: "error", errors: userErrors };
    }

    return { status: "success" };
  } catch (e) {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop") || "";
    return redirect(`/app/exit-iframe?shop=${encodeURIComponent(shop)}`);
  }
};

// 3) UI: Multi-select city picker (Allowed Cities = show COD only for these)
export default function EditCustomization() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const initialSelected: string[] = Array.isArray(config.allowedCities)
    ? config.allowedCities
    : [];

  const [selectedCities, setSelectedCities] = useState<string[]>(initialSelected);
  const [inputValue, setInputValue] = useState("");

  const isLoading = navigation.state === "submitting";

  const baseOptions = useMemo(
    () => PAK_CITIES.map((c) => ({ label: c, value: c })),
    []
  );

  const lowerInput = inputValue.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    const opts = baseOptions.filter((o) =>
      o.label.toLowerCase().includes(lowerInput)
    );

    const exists =
      lowerInput.length > 0 &&
      (baseOptions.some((o) => o.label.toLowerCase() === lowerInput) ||
        selectedCities.some((c) => c.toLowerCase() === lowerInput));

    if (lowerInput && !exists) {
      const toAdd = toTitleCase(inputValue);
      opts.push({ label: `Add "${toAdd}"`, value: `__ADD__${toAdd}` });
    }
    return opts;
  }, [baseOptions, lowerInput, inputValue, selectedCities]);

  const handleSelect = (newSelected: string[]) => {
    const normalized = newSelected.map((v) =>
      v.startsWith("__ADD__") ? v.replace("__ADD__", "") : v
    );

    const next = Array.from(
      new Set(
        normalized.map((c) => toTitleCase(String(c).trim())).filter(Boolean)
      )
    );

    setSelectedCities(next);
    setInputValue("");
  };

  const handleRemoveTag = (city: string) => {
    setSelectedCities((prev) => prev.filter((c) => c !== city));
  };

  const textField = (
    <Autocomplete.TextField
      label="Allowed cities"
      value={inputValue}
      onChange={setInputValue}
      autoComplete="off"
      placeholder="Search or add cities…"
      helpText="COD will show only when checkout city matches one of these"
    />
  );

  const handleSave = () => {
    submit(
      { allowedCitiesJson: JSON.stringify(selectedCities) },
      { method: "post" }
    );
  };

  return (
    <Page title="Show COD only for selected cities">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Banner title="How this works" tone="info">
                <p>
                  COD will be shown only when the entered city matches one of the selected cities below.
                  For any other city, COD is hidden.
                </p>
              </Banner>

              <BlockStack gap="300">
                <Autocomplete
                  allowMultiple
                  options={filteredOptions}
                  selected={selectedCities}
                  onSelect={handleSelect}
                  textField={textField}
                />

                {selectedCities.length > 0 && (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm">
                      Selected cities ({selectedCities.length})
                    </Text>
                    <InlineStack gap="200" wrap>
                      {selectedCities.map((city) => (
                        <Tag key={city} onRemove={() => handleRemoveTag(city)}>
                          {city}
                        </Tag>
                      ))}
                    </InlineStack>
                  </BlockStack>
                )}

                <Box display="flex" justifyContent="end">
                  <Button variant="primary" onClick={handleSave} loading={isLoading}>
                    Save
                  </Button>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Helpers
function toTitleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Searchable list of Pakistani cities (extend as needed)
const PAK_CITIES: string[] = [
  "Islamabad",
  "Karachi",
  "Lahore",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Hyderabad",
  "Gujranwala",
  "Sialkot",
  "Sargodha",
  "Bahawalpur",
  "Sukkur",
  "Larkana",
  "Sheikhupura",
  "Rahim Yar Khan",
  "Jhang",
  "Gujrat",
  "Mardan",
  "Kasur",
  "Sahiwal",
  "Okara",
  "Wah Cantonment",
  "Mingora (Swat)",
  "Dera Ghazi Khan",
  "Nawabshah (Shaheed Benazirabad)",
  "Mirpur Khas",
  "Chiniot",
  "Khanewal",
  "Hafizabad",
  "Dera Ismail Khan",
  "Turbat",
  "Muridke",
  "Muzaffargarh",
  "Kohat",
  "Abbottabad",
  "Burewala",
  "Jhelum",
  "Bahawalnagar",
  "Kamoke",
  "Mandi Bahauddin",
  "Sadiqabad",
  "Gojra",
  "Nowshera",
  "Charsadda",
  "Tando Allahyar",
  "Tando Muhammad Khan",
  "Matiari",
  "Sanghar",
  "Shikarpur",
  "Jacobabad",
  "Khairpur",
  "Thatta",
  "Badin",
  "Umerkot",
  "Daska",
  "Pakpattan",
  "Layyah",
  "Vehari",
  "Kot Addu",
  "Jaranwala",
  "Chakwal",
  "Attock",
  "Kotri",
  "Hala",
  "Jamshoro",
  "Sehwan",
  "Hub",
  "Mastung",
  "Ziarat",
  "Kalat",
  "Khuzdar",
  "Gwadar",
  "Kharian",
  "Mianwali",
  "Bhakkar",
  "Narowal",
  "Toba Tek Singh",
  "Haripur",
  "Swabi",
  "Mansehra",
  "Bannu",
  "Chaman",
  "Gilgit",
  "Skardu",
  "Hunza",
  "Ghizer",
  "Muzaffarabad (AJK)",
  "Mirpur (AJK)",
  "Kotli (AJK)",
];