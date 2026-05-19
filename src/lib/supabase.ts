import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hxxkvohbggaiegeecaut.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4eGt2b2hiZ2dhaWVnZWVjYXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTAxMjksImV4cCI6MjA5NDY4NjEyOX0.TdoArgbaOEvwnpzBHmuEiuDVmW7dEbss5fGp-AmG4MI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
