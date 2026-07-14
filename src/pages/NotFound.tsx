import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Home, CalendarDays, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/common/SEO";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <SEO
        title={t('seo.notFound.title')}
        description={t('seo.notFound.description')}
        path={location.pathname}
        noindex
      />
      <main className="w-full max-w-md text-center">
        <p className="text-7xl font-extrabold tracking-tight text-primary">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          {t("notFound.title", "Página no encontrada")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "notFound.description",
            "Lo sentimos, la página que buscas no existe o ha sido movida."
          )}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch justify-center gap-2">
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              {t("notFound.backHome", "Volver al inicio")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/events">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {t("nav.events", "Eventos")}
            </Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common.back", "Atrás")}
        </button>
      </main>
    </div>
  );
};

export default NotFound;
