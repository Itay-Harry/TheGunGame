const SUPABASE_URL = "https://pzufxmrfmepzamuntdzm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6dWZ4bXJmbWVwemFtdW50ZHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTU5ODAsImV4cCI6MjA4NjgzMTk4MH0.RjcAgF5JjEs3yimqgTawlRbFWjNjKOcbwOHOpdRxuUg";

let supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
	supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
	console.warn('Supabase CDN failed to load; continuing without remote leaderboard.');
}
window.supabaseClient = supabaseClient;
