import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'hierarchy'

    if (view === 'hierarchy') {
      // Get hierarchical theme data
      const { data: hierarchyData, error: hierarchyError } = await supabase
        .from('v_theme_hierarchy')
        .select('*')
        .order('main_category', { ascending: true })
        .order('response_count', { ascending: false })

      if (hierarchyError) {
        console.error('Error fetching theme hierarchy:', hierarchyError)
        return NextResponse.json({ error: 'Failed to fetch theme hierarchy' }, { status: 500 })
      }

      return NextResponse.json({ 
        data: hierarchyData || [],
        count: hierarchyData?.length || 0
      })

    } else if (view === 'stats') {
      // Get theme hierarchy statistics
      const { data: statsData, error: statsError } = await supabase
        .from('v_theme_hierarchy_stats')
        .select('*')
        .order('main_category', { ascending: true })
        .order('total_responses', { ascending: false })

      if (statsError) {
        console.error('Error fetching theme hierarchy stats:', statsError)
        return NextResponse.json({ error: 'Failed to fetch theme hierarchy stats' }, { status: 500 })
      }

      return NextResponse.json({ 
        data: statsData || [],
        count: statsData?.length || 0
      })

    } else if (view === 'mapping') {
      // Get theme mapping for a specific theme
      const theme = searchParams.get('theme')
      if (!theme) {
        return NextResponse.json({ error: 'Theme parameter is required' }, { status: 400 })
      }

      const { data: mappingData, error: mappingError } = await supabase
        .rpc('get_theme_mapping', { p_theme_name: theme })

      if (mappingError) {
        console.error('Error fetching theme mapping:', mappingError)
        return NextResponse.json({ error: 'Failed to fetch theme mapping' }, { status: 500 })
      }

      return NextResponse.json({ 
        data: mappingData?.[0] || null
      })

    } else {
      return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 })
    }

  } catch (error) {
    console.error('Theme hierarchy API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
