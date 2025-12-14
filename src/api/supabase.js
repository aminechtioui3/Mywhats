import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = 'https://bpousipzgmceahrbmmkl.supabase.co';
const SUPABASE_ANON_KEY ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwb3VzaXB6Z21jZWFocmJtbWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTM0NTYsImV4cCI6MjA3OTk4OTQ1Nn0.9kXz2N4gKVhmJlJzzvu7NiUKEw0CuqiYo2AWcbp_TGI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
