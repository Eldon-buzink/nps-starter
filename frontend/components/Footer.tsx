import Link from 'next/link'
import { Heart, Github, Mail, Phone, MapPin, Calendar, BarChart3, Users, Settings } from 'lucide-react'

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
              Advanced Net Promoter Score analysis and customer feedback insights. 
              Transform your customer feedback into actionable business intelligence.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://github.com" 
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a 
                href="mailto:support@npsinsights.com" 
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Email"
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
                <Link href="/themes" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Themes</span>
                </Link>
              </li>
              <li>
                <Link href="/responses" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Responses</span>
                </Link>
              </li>
              <li>
                <Link href="/trends" className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Trends</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Features</h3>
            <ul className="space-y-2">
              <li className="text-gray-600 text-sm">AI Theme Discovery</li>
              <li className="text-gray-600 text-sm">Dynamic Normalization</li>
              <li className="text-gray-600 text-sm">Trend Analysis</li>
              <li className="text-gray-600 text-sm">Sentiment Tracking</li>
              <li className="text-gray-600 text-sm">Promoter/Detractor Insights</li>
              <li className="text-gray-600 text-sm">Real-time Dashboard</li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Support</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>support@npsinsights.com</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-start space-x-3 text-sm text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                <span>123 Business Ave<br />Suite 100<br />San Francisco, CA 94105</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>© {currentYear} NPS Insights Tool. All rights reserved.</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <Link href="/settings" className="text-gray-500 hover:text-gray-700 transition-colors flex items-center space-x-1">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
              <a href="/privacy" className="text-gray-500 hover:text-gray-700 transition-colors">
                Privacy Policy
              </a>
              <a href="/terms" className="text-gray-500 hover:text-gray-700 transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
              <Heart className="h-3 w-3 text-red-500" />
              <span>Made with passion for customer insights</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
