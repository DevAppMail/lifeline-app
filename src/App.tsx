import { type ReactNode, Component, type ErrorInfo, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import { BreadcrumbBar } from "@/components/breadcrumb-bar";
import NotFound from "@/pages/not-found";

// ── Scroll to top on every route change ──────────────────────────────────────────
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  return null;
}

// ── Global error boundary ──────────────────────────────────────────────────────
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("App crash:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <span className="text-red-600 font-bold text-xl">!</span>
          </div>
          <p className="font-bold text-foreground mb-1">Something went wrong</p>
          <p className="text-sm text-muted-foreground mb-5">{(this.state.error as Error).message}</p>
          <button
            className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl"
            onClick={() => this.setState({ error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import Login from "@/pages/login";
import Onboarding from "@/pages/onboarding";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import RequestBlood from "@/pages/request-blood";
import RequestConfirmation from "@/pages/request-confirmation";
import Donate from "@/pages/donate";
import Requests from "@/pages/requests";
import RequestDetail from "@/pages/request-detail";
import BookDoctor from "@/pages/book-doctor";
import DoctorProfile from "@/pages/doctor-profile";
import BookAppointment from "@/pages/book-appointment";
import BookingConfirmed from "@/pages/booking-confirmed";
import Health from "@/pages/health";
import HealthTimeline from "@/pages/health-timeline";
import FollowUps from "@/pages/follow-ups";
import Providers from "@/pages/providers";
import CareCircle from "@/pages/care-circle";
import Events from "@/pages/events";
import EventDetail from "@/pages/event-detail";
import AuthCallback from "@/pages/auth-callback";
import NotificationsPage from "@/pages/notifications";
import RequestStatus from "@/pages/request-status";
import VoluntaryDonation from "@/pages/voluntary-donation";

const queryClient = new QueryClient();

// Public paths that don't require authentication
const PUBLIC_PATHS = new Set(["/", "/login", "/auth/callback"]);

function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useProfile();
  const [location, navigate] = useLocation();

  const DEV_BYPASS = import.meta.env.VITE_APP_MODE !== 'production' && localStorage.getItem("lifeline_dev_bypass") === "true";

  if (DEV_BYPASS) return <>{children}</>;
  if (isLoading) return null;
  if (!isAuthenticated && !PUBLIC_PATHS.has(location)) {
    navigate("/login");
    return null;
  }
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
      <Route path="/request-confirmation" component={RequestConfirmation} />
      <Route path="/donate" component={Donate} />
      <Route path="/requests" component={Requests} />
      <Route path="/requests/:id" component={RequestDetail} />
      <Route path="/book-doctor" component={BookDoctor} />
      <Route path="/doctor/:id" component={DoctorProfile} />
      <Route path="/book-appointment/:doctorId" component={BookAppointment} />
      <Route path="/booking-confirmed" component={BookingConfirmed} />
      <Route path="/health" component={Health} />
      <Route path="/health-timeline" component={HealthTimeline} />
      <Route path="/follow-ups" component={FollowUps} />
      <Route path="/providers" component={Providers} />
      <Route path="/care-circle" component={CareCircle} />
      <Route path="/events" component={Events} />
      <Route path="/events/:id" component={EventDetail} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/request-status" component={RequestStatus} />
      <Route path="/request-status/:id" component={RequestStatus} />
      <Route path="/voluntary-donation" component={VoluntaryDonation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ProfileProvider>
          <TooltipProvider>
            <div className="w-full flex justify-center bg-zinc-950 min-h-[100dvh]">
              <div className="w-full max-w-[430px] bg-background shadow-2xl relative overflow-x-hidden min-h-[100dvh]">
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <AuthGuard>
                    <ScrollToTop />
                    <BreadcrumbBar />
                    <Router />
                  </AuthGuard>
                </WouterRouter>
                <Toaster />
              </div>
            </div>
          </TooltipProvider>
        </ProfileProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
