import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hgdkahwximatlgtwqgph.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnZGthaHd4aW1hdGxndHdxZ3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NzU2NTIsImV4cCI6MjA3NTM1MTY1Mn0.aRvTlFuADw49xuRRQ9E_zAxXVvyxt7elePd0bFwSF5o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);