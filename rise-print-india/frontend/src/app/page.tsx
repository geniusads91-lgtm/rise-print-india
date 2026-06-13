import Image from "next/image";
import Link from "next/link";
import { Printer, Phone, MapPin, Mail } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Printer className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">Rise Print India</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <Link href="/products" className="text-gray-700 hover:text-primary-600 transition-colors">Products</Link>
              <Link href="/about" className="text-gray-700 hover:text-primary-600 transition-colors">About</Link>
              <Link href="/contact" className="text-gray-700 hover:text-primary-600 transition-colors">Contact</Link>
              <Link href="/auth/login" className="btn-primary">Login</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                Premium Printing Solutions for Your Business
              </h1>
              <p className="text-lg lg:text-xl text-primary-100">
                Quality printing services across all 75 districts of Uttar Pradesh. 
                From visiting cards to large format banners, we've got you covered.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/products" className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors">
                  Browse Products
                </Link>
                <Link href="/contact" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
                  Contact Us
                </Link>
              </div>
              <div className="flex items-center space-x-8 pt-4">
                <div>
                  <p className="text-3xl font-bold">75+</p>
                  <p className="text-primary-200">Districts Covered</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">10K+</p>
                  <p className="text-primary-200">Happy Customers</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">500+</p>
                  <p className="text-primary-200">Distributors</p>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative h-96 w-full">
                {/* Placeholder for hero image */}
                <div className="absolute inset-0 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <Printer className="h-32 w-32 text-white/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Our Product Categories</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore our wide range of printing products tailored for businesses of all sizes
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { name: 'Visiting Cards', icon: '📇' },
              { name: 'Flex Banners', icon: '🖼️' },
              { name: 'Posters', icon: '📰' },
              { name: 'Brochures', icon: '📖' },
              { name: 'Pamphlets', icon: '📄' },
              { name: 'Stickers', icon: '🏷️' },
              { name: 'Letterheads', icon: '✉️' },
              { name: 'Wedding Cards', icon: '💌' },
              { name: 'Custom Products', icon: '🎨' },
              { name: 'Large Format', icon: '📐' },
            ].map((category) => (
              <Link 
                key={category.name}
                href={`/products?category=${category.name}`}
                className="card text-center hover:scale-105 transition-transform duration-300"
              >
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="font-medium text-gray-900">{category.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* District Coverage */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Serving All of Uttar Pradesh</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our extensive distributor network covers every district in Uttar Pradesh
            </p>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {[
              'Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj',
              'Ghaziabad', 'Meerut', 'Bareilly', 'Aligarh', 'Moradabad',
            ].map((district) => (
              <div 
                key={district}
                className="bg-gray-50 rounded-lg p-3 text-center hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <p className="text-sm font-medium text-gray-700">{district}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/districts" className="text-primary-600 hover:text-primary-700 font-medium">
              View all 75 districts →
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-primary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Why Choose Rise Print India?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Quality Assurance',
                description: 'Premium printing quality with strict quality control at every step.',
                icon: '✓',
              },
              {
                title: 'Fast Delivery',
                description: 'Quick turnaround times with our efficient district-wise distribution network.',
                icon: '⚡',
              },
              {
                title: 'Competitive Pricing',
                description: 'Best prices in the market with bulk order discounts.',
                icon: '₹',
              },
              {
                title: 'Easy Ordering',
                description: 'Simple online ordering process with multiple payment options.',
                icon: '🛒',
              },
              {
                title: 'Customer Support',
                description: 'Dedicated support team available to assist you.',
                icon: '📞',
              },
              {
                title: 'Secure Payments',
                description: 'Multiple secure payment methods including UPI and wallet.',
                icon: '🔒',
              },
            ].map((feature) => (
              <div key={feature.title} className="card">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers across Uttar Pradesh. Create your account today and experience premium printing services.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth/register" className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors">
              Register Now
            </Link>
            <Link href="/contact" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Printer className="h-6 w-6 text-primary-400" />
                <span className="text-xl font-bold text-white">Rise Print India</span>
              </div>
              <p className="text-sm text-gray-400">
                Enterprise B2B printing marketplace serving all districts of Uttar Pradesh.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/products" className="hover:text-white transition-colors">Products</Link></li>
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Customer Service</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/tracking" className="hover:text-white transition-colors">Order Tracking</Link></li>
                <li><Link href="/returns" className="hover:text-white transition-colors">Returns Policy</Link></li>
                <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact Info</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start space-x-2">
                  <MapPin className="h-5 w-5 text-primary-400 flex-shrink-0" />
                  <span>Uttar Pradesh, India</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-primary-400 flex-shrink-0" />
                  <span>+91 XXXXX XXXXX</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-primary-400 flex-shrink-0" />
                  <span>info@riseprintindia.com</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 Rise Print India. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
