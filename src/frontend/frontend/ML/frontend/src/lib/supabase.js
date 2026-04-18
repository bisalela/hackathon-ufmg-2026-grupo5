import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isSecretKeyInBrowser =
  typeof supabasePublishableKey === "string" &&
  supabasePublishableKey.startsWith("sb_secret_");

export const supabaseConfigError =
  isSecretKeyInBrowser
    ? "Invalid Supabase key in frontend: use ANON/PUBLISHABLE key, never SERVICE ROLE (sb_secret)."
    : !supabaseUrl || !supabasePublishableKey
    ? "Supabase environment variables are missing."
    : "";

export const supabase =
  supabaseConfigError === ""
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;
