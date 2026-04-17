import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError =
  !supabaseUrl || !supabasePublishableKey
    ? "Supabase environment variables are missing."
    : "";

export const supabase =
  supabaseConfigError === ""
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;
