import Link from 'next/link'
import { Heart, Github, Mail, Phone, MapPin, Calendar, BarChart3, Users, Settings, Upload, FileText, Tag, MessageSquare } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">NPS Insights</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              Internal NPS analysis tool for customer feedback insights. 
              Transform customer feedback into actionable business intelligence.
            </p>
            <div className="flex space-x-4">
              <a 
                href="mailto:analytics@company.com" 
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Email Analytics Team"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Dashboard</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Overview</span>
                </Link>
              </li>
              <li>
                <Link href="/titles" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Title Explorer</span>
                </Link>
              </li>
              <li>
                <Link href="/themes" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <Tag className="h-4 w-4" />
                  <span>Theme Explorer</span>
                </Link>
              </li>
              <li>
                <Link href="/responses" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Response Explorer</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Features</h3>
            <ul className="space-y-2">
              <li className="text-gray-600 text-sm">AI Theme Discovery</li>
              <li className="text-gray-600 text-sm">Dynamic Theme Normalization</li>
              <li className="text-gray-600 text-sm">NPS Trend Analysis</li>
              <li className="text-gray-600 text-sm">Sentiment Tracking</li>
              <li className="text-gray-600 text-sm">Promoter/Detractor Insights</li>
              <li className="text-gray-600 text-sm">Survey Analysis Tool</li>
            </ul>
          </div>

          {/* Tools & Support */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Tools</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/settings/upload" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Data Upload</span>
                </Link>
              </li>
              <li>
                <Link href="/survey-analysis" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Survey Analysis</span>
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>© {currentYear} Internal NPS Insights Tool. All rights reserved.</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <Link href="/settings" className="text-gray-500 hover:text-gray-700 transition-colors flex items-center space-x-1">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
              <span className="text-gray-500">Internal Use Only</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
              <Heart className="h-3 w-3 text-red-500" />
              <span>Made for better customer insights</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
