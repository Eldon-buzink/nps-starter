const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugResponses() {
  console.log('=== DEBUGGING RESPONSE COUNTS ===\n');
  
  try {
    // 1. Total responses in database
    const { count: totalResponses } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true });
    console.log('1. Total responses in database:', totalResponses);
    
    // 2. Check all unique titles and their counts
    const { data: allTitles } = await supabase
      .from('nps_response')
      .select('title_text');
    
    const titleCounts = {};
    allTitles?.forEach(t => {
      titleCounts[t.title_text] = (titleCounts[t.title_text] || 0) + 1;
    });
    
    console.log('\n2. All titles and their response counts:');
    Object.entries(titleCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([title, count]) => {
        console.log(`   ${title}: ${count}`);
      });
    
    // 3. Check BN DeStem specifically without date filters
    const { count: bnDestemTotal } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .eq('title_text', 'BN DeStem');
    console.log(`\n3. BN DeStem total responses (no date filter): ${bnDestemTotal}`);
    
    // 4. Check BN DeStem with date filters
    const { count: bnDestemFiltered } = await supabase
      .from('nps_response')
      .select('*', { count: 'exact', head: true })
      .eq('title_text', 'BN DeStem')
      .gte('created_at', '2024-01-01')
      .lte('created_at', '2025-12-31');
    console.log(`4. BN DeStem with date filter (2024-2025): ${bnDestemFiltered}`);
    
    // 5. Check what date range BN DeStem responses actually have
    const { data: bnDestemDates } = await supabase
      .from('nps_response')
      .select('created_at')
      .eq('title_text', 'BN DeStem')
      .order('created_at', { ascending: true })
      .limit(5);
    
    console.log('\n5. First few BN DeStem response dates:');
    bnDestemDates?.forEach((item, i) => {
      console.log(`   ${i+1}. ${item.created_at}`);
    });
    
    // 6. Check latest dates
    const { data: bnDestemLatestDates } = await supabase
      .from('nps_response')
      .select('created_at')
      .eq('title_text', 'BN DeStem')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('\n6. Latest BN DeStem response dates:');
    bnDestemLatestDates?.forEach((item, i) => {
      console.log(`   ${i+1}. ${item.created_at}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugResponses();
