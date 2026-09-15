import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * Cliente con service role. Salta RLS, asi que no puede tocar el browser
 * jamas: todas las tablas del piloto estan cerradas y este es el unico camino
 * de entrada.
 */
let cliente: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}
