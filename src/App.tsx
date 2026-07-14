import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { AppModeProvider } from "./contexts/AppModeContext";
import MainLayout from "./components/layout/MainLayout";
import Index from "./pages/Index";
import EventsPage from "./pages/EventsPage";
import NotFound from "./pages/NotFound";

// Lazy-load heavy / secondary routes to reduce initial bundle & TTI
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const PharmaciesPage = lazy(() => import("./pages/PharmaciesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const AddTicketPage = lazy(() => import("./pages/AddTicketPage"));
const SubmitEventPage = lazy(() => import("./pages/SubmitEventPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const VenuesPage = lazy(() => import("./pages/VenuesPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const MunicipalityAgendaPage = lazy(() => import("./pages/MunicipalityAgendaPage"));
const SportsPage = lazy(() => import("./pages/SportsPage"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-background">
    <div
      className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
      role="status"
      aria-label="Cargando"
    />
  </div>
);

const App = () => (
  <ThemeProvider>
    <AppModeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Main layout with bottom nav */}
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/pharmacies" element={<PharmaciesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route path="/venues" element={<VenuesPage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/agenda/:municipalitySlug" element={<MunicipalityAgendaPage />} />
                </Route>

                {/* Pages without bottom nav */}
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/reset" element={<ResetPasswordPage />} />
                <Route path="/tickets/add" element={<AddTicketPage />} />
                <Route path="/submit-event" element={<SubmitEventPage />} />
                <Route path="/admin" element={<AdminPage />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
    </AppModeProvider>
  </ThemeProvider>
);

export default App;
