const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './frontend/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyFixes() {
  console.log('=== VERIFYING FIXES ===\n');
  
  try {
    // 1. Check total responses with correct column name
    const { count: totalResponses } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true });
    console.log('1. Total responses in database:', totalResponses);
    
    // 2. Check BN DeStem responses with correct column name
    const { count: bnDestemResponses } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .eq('title_text', 'BN DeStem')
      .gte('created_at', '2024-01-01')
      .lte('created_at', '2025-12-31');
    console.log('2. BN DeStem responses (with date filter):', bnDestemResponses);
    
    // 3. Check if synonym mappings are working
    const { data: synonymMappings } = await supabase
      .from('theme_synonyms')
      .select('synonym, canonical')
      .ilike('synonym', '%content%');
    
    console.log('3. Content-related synonym mappings:');
    synonymMappings?.forEach(mapping => {
      console.log(`   ${mapping.synonym} → ${mapping.canonical}`);
    });
    
    // 4. Check theme assignments for BN DeStem
    const { data: themeAssignments } = await supabase
      .from('v_theme_assignments_normalized')
      .select('canonical_theme, nps_response!inner(title_text)')
      .eq('nps_response.title_text', 'BN DeStem')
      .gte('nps_response.created_at', '2024-01-01')
      .lte('nps_response.created_at', '2025-12-31');
    
    console.log(`4. Theme assignments for BN DeStem: ${themeAssignments?.length || 0}`);
    
    // 5. Group by theme to see distribution
    const themeCounts = {};
    themeAssignments?.forEach(item => {
      const theme = item.canonical_theme;
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });
    
    console.log('5. Theme distribution:');
    Object.entries(themeCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([theme, count]) => {
        console.log(`   ${theme}: ${count}`);
      });
      
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyFixes();
