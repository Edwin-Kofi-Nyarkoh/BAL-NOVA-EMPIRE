import { VendorStorefrontPage as VendorStorefrontView } from "@/components/storefront/vendor-storefront-page"

type VendorStorefrontPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function VendorStorefrontPage({ params }: VendorStorefrontPageProps) {
  const { id } = await params
  return <VendorStorefrontView vendorId={id} />
}
