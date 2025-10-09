"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import TitlePageSkeleton from './TitlePageSkeleton';

interface LoadingWrapperProps {
  children: React.ReactNode;
}

export default function LoadingWrapper({ children }: LoadingWrapperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href) {
        const url = new URL(link.href);
        const targetPath = url.pathname;
        
        // Check if it's a title page link and we're navigating to a different title
        if (targetPath.startsWith('/titles/') && targetPath !== '/titles' && targetPath !== pathname) {
          setIsLoading(true);
          
          // Navigate after showing skeleton
          setTimeout(() => {
            router.push(targetPath);
          }, 100);
        }
      }
    };

    // Add click listener to document
    document.addEventListener('click', handleLinkClick);

    return () => {
      document.removeEventListener('click', handleLinkClick);
    };
  }, [router, pathname]);

  // Hide skeleton when we're on the target page
  useEffect(() => {
    if (isLoading) {
      // Hide skeleton after a short delay to ensure content has loaded
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, pathname]);

  // Show skeleton when loading
  if (isLoading) {
    return <TitlePageSkeleton />;
  }

  return <>{children}</>;
}
