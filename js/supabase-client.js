// Shared Supabase client for the gradual app.js split.
// This module is non-breaking: app.js can keep its local constants until it is safely edited.
(function () {
  const SUPABASE_URL = "https://welleqrjtlullhbdhive.supabase.co";
  const SUPABASE_KEY = "sb_publishable_e_Pu1JLmyXBKJnMvR5guXQ_GzvFcdK-";

  if (!window.supabase?.createClient) {
    console.warn("Supabase SDK is not loaded. ABA Supabase client was not created.");
    return;
  }

  const existingClient = window.ABASupabase?.client || window.supabaseClient;
  const client = existingClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  window.ABASupabase = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    client
  };

  window.supabaseClient = window.supabaseClient || client;
})();
