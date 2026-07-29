/*
 * Supabase project connection settings.
 *
 * These two values are SAFE to expose in client-side code:
 * the anon key only grants the access you explicitly allow via
 * Row Level Security (RLS) policies in the database.
 *
 * Fill these in from your Supabase project (Dashboard -> Connect, or
 * Dashboard -> Project Settings -> API Keys):
 *   - "Project URL"                                  -> SUPABASE_URL
 *   - "anon public" key, or the newer "Publishable
 *     key" (starts with sb_publishable_...)          -> SUPABASE_ANON_KEY
 *
 * Either the legacy anon key or the newer publishable key works here -
 * they grant the same low-privilege, RLS-governed access.
 */
window.SUPABASE_URL = "https://spxyxhgqxroshioqmors.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_DJZBEuzXWJ4WVOTtx59wWw_yYK0hcrx";
