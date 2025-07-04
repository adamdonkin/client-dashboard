import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Revenue statistics functions
export async function getRevenueStats() {
  const { data, error } = await supabase
    .rpc('get_revenue_stats')
    .single();
    
  if (error) {
    console.error('Error fetching revenue stats:', error);
    return null;
  }
  
  return data;
}

export async function getRevenueBreakdown() {
  const { data, error } = await supabase
    .rpc('get_revenue_breakdown');
    
  if (error) {
    console.error('Error fetching revenue breakdown:', error);
    return [];
  }
  
  return data || [];
}