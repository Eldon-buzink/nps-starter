"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TitlePageSkeleton from './TitlePageSkeleton';

interface LoadingWrapperProps {
  children: React.ReactNode;
}

export default function LoadingWrapper({ children }: LoadingWrapperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href) {
        const url = new URL(link.href);
        const pathname = url.pathname;
        
        // Check if it's a title page link
        if (pathname.startsWith('/titles/') && pathname !== '/titles') {
          setIsLoading(true);
          setLoadingPath(pathname);
          
          // Navigate after showing skeleton
          setTimeout(() => {
            router.push(pathname);
          }, 100);
        }
      }
    };

    // Add click listener to document
    document.addEventListener('click', handleLinkClick);

    return () => {
      document.removeEventListener('click', handleLinkClick);
    };
  }, [router]);

  // Show skeleton when loading
  if (isLoading) {
    return <TitlePageSkeleton />;
  }

  return <>{children}</>;
}
