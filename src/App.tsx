import { useEffect, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Onboarding from "@/pages/onboarding";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import RequestBlood from "@/pages/request-blood";
import Donate from "@/pages/donate";
import Requests from "@/pages/requests";
import RequestDetail from "@/pages/request-detail";
import BookDoctor from "@/pages/book-doctor";
import DoctorProfile from "@/pages/doctor-profile";
import BookAppointment from "@/pages/book-appointment";
import BookingConfirmed from "@/pages/booking-confirmed";
import Health from "@/pages/health";
import Events from "@/pages/events";
import EventDetail from "@/pages/event-detail";

const queryClient = new QueryClient();

// Public paths that don't require authentication
const PUBLIC_PATHS = new Set(["/", "/login"]);

const DEV_BYPASS = typeof window !== "undefined" && localStorage.getItem("DEV_BYPASS") === "true";

function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useProfile();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !DEV_BYPASS && !PUBLIC_PATHS.has(location)) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, location, navigate]);

  // Block render of protected routes until session is resolved (bypass skips the wait)
  if (isLoading && !DEV_BYPASS && !PUBLIC_PATHS.has(location)) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/home" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/request-blood" component={RequestBlood} />
      <Route path="/donate" component={Donate} />
      <Route path="/requests" component={Requests} />
      <Route path="/requests/:id" component={RequestDetail} />
      <Route path="/book-doctor" component={BookDoctor} />
      <Route path="/doctor/:id" component={DoctorProfile} />
      <Route path="/book-appointment/:doctorId" component={BookAppointment} />
      <Route path="/booking-confirmed" component={BookingConfirmed} />
      <Route path="/health" component={Health} />
      <Route path="/events" component={Events} />
      <Route path="/events/:id" component={EventDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <TooltipProvider>
          <div className="w-full flex justify-center bg-zinc-950 min-h-[100dvh]">
            <div className="w-full max-w-[430px] bg-background shadow-2xl relative overflow-x-hidden min-h-[100dvh]">
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AuthGuard>
                  <Router />
                </AuthGuard>
              </WouterRouter>
              {/* Platform identity footer */}
              <div
                className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] py-1.5 px-4 bg-background/80 backdrop-blur-sm text-center pointer-events-none"
                style={{ zIndex: 4 }}
              >
                <p className="text-[10px] text-muted-foreground/40 leading-tight">
                  LifeLine is a voluntary donor matching platform — not a blood bank or medical service provider.
                </p>
              </div>
              <Toaster />
            </div>
          </div>
        </TooltipProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}

export default App;
