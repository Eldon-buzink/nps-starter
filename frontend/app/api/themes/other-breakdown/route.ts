import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('v_other_breakdown')
      .select('*')
      .order('mentions', { ascending: false });

    if (error) {
      console.error('Error fetching other breakdown:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ other: data || [] });
  } catch (error) {
    console.error('Error in other breakdown API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
