import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useProfile } from "@/context/profile-context";
import { Activity } from "lucide-react";

export default function Splash() {
  const [, setLocation] = useLocation();
  const { profile, isLoading } = useProfile();

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (profile) {
        setLocation("/home");
      } else {
        setLocation("/login");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [profile, isLoading, setLocation]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-primary text-primary-foreground relative overflow-hidden">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6 shadow-2xl relative">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="absolute inset-0 bg-white/20 rounded-full"
          />
          <Activity className="w-12 h-12 text-white" />
        </div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-bold tracking-tight"
        >
          LifeLine
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-primary-foreground/80 mt-2 font-medium tracking-wide"
        >
          Saving lives, together.
        </motion.p>
      </motion.div>
    </div>
  );
}
