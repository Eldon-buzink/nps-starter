"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BarChart3, Upload, Settings, Home, MessageSquare, Tag, TrendingUp, Brain } from "lucide-react"

export function Navigation() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <BarChart3 className="h-6 w-6" />
              <span className="text-xl font-bold">NPS Insights</span>
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <Link href="/overview">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Overview</span>
                </Button>
              </Link>
              <Link href="/responses">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Responses</span>
                </Button>
              </Link>
              <Link href="/themes">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Tag className="h-4 w-4" />
                  <span>Themes</span>
                </Button>
              </Link>
              <Link href="/trends">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Trends</span>
                </Button>
              </Link>
              <Link href="/ai-enrichment">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Brain className="h-4 w-4" />
                  <span>AI Analysis</span>
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/settings/upload">
              <Button variant="ghost" size="icon" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
