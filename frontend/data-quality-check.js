const { createClient } = require('@supabase/supabase-js');

// Use the same environment variables as the app
const supabase = createClient(
  'https://your-project.supabase.co', // Replace with your actual URL
  'your-anon-key' // Replace with your actual key
);

async function checkDataQuality() {
  console.log('=== DATA QUALITY CHECK ===\n');
  
  try {
    // 1. Total responses in database
    const { count: totalResponses } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true });
    console.log('1. Total responses in database:', totalResponses);
    
    // 2. Responses for BN DeStem specifically
    const { count: bnDestemResponses } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .eq('title_text', 'BN DeStem');
    console.log('2. BN DeStem responses:', bnDestemResponses);
    
    // 3. Check theme assignments for BN DeStem
    const { data: themeAssignments } = await supabase
      .from('v_theme_assignments_normalized')
      .select('canonical_theme, nps_response!inner(title_text)')
      .eq('nps_response.title_text', 'BN DeStem');
    
    console.log('3. Theme assignments for BN DeStem:', themeAssignments?.length || 0);
    
    // 4. Group by theme
    const themeCounts = {};
    themeAssignments?.forEach(item => {
      const theme = item.canonical_theme;
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });
    
    console.log('\n4. Theme breakdown for BN DeStem:');
    Object.entries(themeCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([theme, count]) => {
        console.log(`   ${theme}: ${count}`);
      });
    
    const totalThemeMentions = Object.values(themeCounts).reduce((sum, count) => sum + count, 0);
    console.log(`\n   Total theme mentions: ${totalThemeMentions}`);
    console.log(`   Should match responses: ${bnDestemResponses}`);
    console.log(`   Difference: ${totalThemeMentions - bnDestemResponses}`);
    
    // 5. Check "other" category specifically
    const otherCount = themeCounts['Other (cluster)'] || 0;
    console.log(`\n5. "Other (cluster)" count: ${otherCount} (${((otherCount / bnDestemResponses) * 100).toFixed(1)}%)`);
    
    // 6. Check what's in "other" - get sample responses
    const { data: otherResponses } = await supabase
      .from('v_theme_assignments_normalized')
      .select(`
        canonical_theme,
        nps_response!inner(title_text, nps_explanation)
      `)
      .eq('nps_response.title_text', 'BN DeStem')
      .eq('canonical_theme', 'Other (cluster)')
      .limit(10);
    
    console.log('\n6. Sample "Other (cluster)" responses:');
    otherResponses?.forEach((item, i) => {
      console.log(`   ${i+1}. ${item.nps_response.nps_explanation?.substring(0, 100)}...`);
    });
    
    // 7. Check all unique titles and their response counts
    const { data: allTitles } = await supabase
      .from('nps_response')
      .select('title_text');
    
    const titleCounts = {};
    allTitles?.forEach(t => {
      titleCounts[t.title_text] = (titleCounts[t.title_text] || 0) + 1;
    });
    
    console.log('\n7. Top 10 titles by response count:');
    Object.entries(titleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([title, count]) => {
        console.log(`   ${title}: ${count}`);
      });
      
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDataQuality();
