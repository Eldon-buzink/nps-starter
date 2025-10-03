# Bulk AI Enrichment Guide

## What This Does

The `bulk_enrich.py` script processes all NPS responses that have comments but haven't been AI-analyzed yet. It will:

1. **Discover themes** from your feedback (like "delivery", "pricing", "content_kwaliteit")
2. **Classify each response** into themes
3. **Extract sentiment** and keywords
4. **Create embeddings** for semantic search

## Current Status (Het Parool Example)

```
Total Responses: 821
With Comments: 683 (83.2%)
AI Enriched: 0 (0.0%)
```

**Result**: You're missing insights from 683 valuable customer comments! 😱

## How to Run

### Step 1: Make Sure Your Frontend is Running

The script calls your Next.js API, so start the frontend:

```bash
cd frontend
npm run dev
```

Keep this terminal open!

### Step 2: Run the Bulk Enrichment Script (in a new terminal)

```bash
cd /Users/eldonbuzink/nps-starter
python3 bulk_enrich.py
```

### Step 3: Follow the Prompts

The script will:
1. Show you current stats (total, enriched, pending)
2. Show breakdown by title (which titles need enrichment most)
3. Ask for confirmation
4. Ask how many batches to process

**Recommended for first run:**
- Start with **5-10 batches** (500-1000 responses) to test
- Check the results in your UI
- Then run unlimited batches to complete everything

## What to Expect

### Processing Time
- **~2 seconds per response** (AI analysis + embedding)
- **100 responses per batch** = ~3-4 minutes per batch
- **683 responses** (Het Parool) = ~25-30 minutes
- **All titles** (depends on total pending)

### Cost Estimate
- **~$0.002 per response** (OpenAI API: GPT-4o-mini + embeddings)
- **683 responses** = ~$1.40
- **Total pending across all titles** = varies

### Progress Display

```
📦 Processing Batch #1...
   ✅ Processed: 95
   ⏭️  Skipped (no comment): 3
   ❌ Failed: 2
   🎯 Themes discovered: 8

📊 Total Progress:
   Processed: 95
   Skipped: 3
   Failed: 2
```

## After Enrichment

Once complete:
1. **Refresh your browser** (may need hard refresh: Cmd+Shift+R)
2. **Go to Title Explorer** → Select "Het Parool"
3. **Check the coverage card**: Should show 100% enriched!
4. **View themes**: All 683 responses will now be categorized

## Safety Features

- **Batch processing**: Processes 100 at a time (won't overwhelm API)
- **Rate limiting**: 2-second delay between batches
- **Error handling**: Failed responses are logged but don't stop the process
- **Resume capability**: Re-running the script will only process remaining unenriched responses

## Troubleshooting

### Error: "Connection refused"
- **Solution**: Make sure your Next.js frontend is running (`npm run dev`)

### Error: "OpenAI API key not found"
- **Solution**: Check your `.env` file has `OPENAI_API_KEY`

### Error: "Supabase connection failed"
- **Solution**: Check your `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Enrichment seems slow
- **Normal**: AI analysis takes time. 2-3 seconds per response is expected
- **Speed it up**: OpenAI API has rate limits, but you can request higher limits

### Some responses still show 0% enriched
- **Possible causes**:
  1. Those responses have empty/null comments
  2. Comments are "n.v.t." or "nvt" (these are skipped)
  3. The enrichment failed for those specific responses (check console logs)

## Re-Running Enrichment

The script is **idempotent** - running it multiple times is safe:
- Already enriched responses are skipped automatically
- Only new/failed responses will be processed
- You can run it regularly as new data comes in

## Next Steps After Enrichment

1. ✅ Check Het Parool: Should show 683 enriched responses
2. ✅ Verify themes: Click on themes to see detailed insights
3. ✅ Check other titles: Run enrichment for all titles
4. ✅ Regular updates: Run this script whenever new NPS data is uploaded

---

**Need Help?** Check the console output for detailed error messages.

