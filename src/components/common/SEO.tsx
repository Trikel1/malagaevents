import { Helmet } from "react-helmet-async";

const SITE = "https://malagaevents.lovable.app";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
}

/**
 * Per-route head tags. Title kept ≤60 chars, description 50–160 chars.
 * Canonical and og:url self-reference the current route.
 */
const SEO = ({ title, description, path, type = "website", image }: SEOProps) => {
  const url = `${SITE}${path}`;
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
    </Helmet>
  );
};

export default SEO;
