export const config = {
  port: parseInt(process.env.BFF_PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  supabaseUrl: process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",

  adminApiUrl: process.env.ADMIN_API_URL || "http://localhost:3000",
  adminBffApiKey: process.env.ADMIN_BFF_API_KEY || "bff-dev-key",

  proSupabaseUrl: process.env.PRO_SUPABASE_URL || "",
  proSupabaseServiceKey: process.env.PRO_SUPABASE_SERVICE_KEY || "",

  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-do-not-use-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
};
