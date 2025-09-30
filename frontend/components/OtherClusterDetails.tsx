"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OtherClusterDetailsProps {
  theme: string;
}

interface OtherItem {
  theme: string;
  mentions: number;
}

export default function OtherClusterDetails({ theme }: OtherClusterDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otherItems, setOtherItems] = useState<OtherItem[] | null>(null);

  const loadOtherBreakdown = async () => {
    if (otherItems || loading) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/themes/other-breakdown', {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch other breakdown');
      }
      
      const data = await response.json();
      setOtherItems(data.other || []);
    } catch (error) {
      console.error('Error loading other breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && !otherItems) {
      await loadOtherBreakdown();
    }
  };

  if (theme !== "Other (cluster)") {
    return null;
  }

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto"
      >
        {isOpen ? (
          <>
            <ChevronDown className="h-4 w-4 mr-1" />
            Hide details
          </>
        ) : (
          <>
            <ChevronRight className="h-4 w-4 mr-1" />
            Show what's inside
          </>
        )}
      </Button>

      {isOpen && (
        <div className="mt-2 text-sm">
          {loading && <div className="text-muted-foreground">Loading...</div>}
          {!loading && otherItems && otherItems.length === 0 && (
            <div className="text-muted-foreground">No items in this cluster.</div>
          )}
          {!loading && otherItems && otherItems.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground mb-2">
                Themes with fewer than 3 mentions:
              </div>
              <ul className="space-y-1">
                {otherItems.map((item, index) => (
                  <li key={index} className="flex justify-between items-center text-xs">
                    <span className="capitalize">{item.theme.replace('_', ' ')}</span>
                    <span className="text-muted-foreground">{item.mentions}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
