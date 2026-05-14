import { Helmet } from "react-helmet-async";

const SITE = "https://malagaevents.lovable.app";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  noindex?: boolean;
  /** One or more JSON-LD objects to embed as <script type="application/ld+json"> */
  jsonLd?: Record<string, any> | Record<string, any>[];
}

/**
 * Per-route head tags. Title kept ≤60 chars, description 50–160 chars.
 * Canonical and og:url self-reference the current route.
 */
const SEO = ({ title, description, path, type = "website", image, noindex, jsonLd }: SEOProps) => {
  const url = `${SITE}${path}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta property="og:image" content={image} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {ldArray.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;

