'use client'

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ThemesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filters Bar Skeleton */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 md:grid-cols-4 p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
        </CardContent>
      </Card>

      {/* Trends Chart Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>

      {/* Theme Discovery Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-16 mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>

          {/* Category Cards Skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, categoryIndex) => (
              <Card key={categoryIndex} className="border-2">
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="text-center space-y-1">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-5 w-12" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, themeIndex) => (
                      <div key={themeIndex} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-6 w-20" />
                          </div>
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Skeleton className="h-4 w-12" />
                              <Skeleton className="h-4 w-8" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
