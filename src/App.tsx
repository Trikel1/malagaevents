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
import EventDetailPage from "./pages/EventDetailPage";
import CalendarPage from "./pages/CalendarPage";
import PharmaciesPage from "./pages/PharmaciesPage";
import ProfilePage from "./pages/ProfilePage";
import AuthPage from "./pages/AuthPage";
import TicketsPage from "./pages/TicketsPage";
import AddTicketPage from "./pages/AddTicketPage";
import SubmitEventPage from "./pages/SubmitEventPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import VenuesPage from "./pages/VenuesPage";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <AppModeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              </Route>
              
              {/* Pages without bottom nav */}
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/tickets/add" element={<AddTicketPage />} />
              <Route path="/submit-event" element={<SubmitEventPage />} />
              <Route path="/admin" element={<AdminPage />} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
    </AppModeProvider>
  </ThemeProvider>
);

export default App;
