'use client';

import { 
  FileText, 
  History, 
  Settings, 
  Download,
  Stethoscope 
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const navigation: NavItem[] = [
  { name: 'New Diagnosis', href: '/', icon: <Stethoscope className="w-5 h-5" /> },
  { name: 'RAG Knowledge Base', href: '/rag', icon: <FileText className="w-5 h-5" /> },
  { name: 'Patient History', href: '/history', icon: <History className="w-5 h-5" /> },
  { name: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
  { name: 'Export Logs', href: '/export', icon: <Download className="w-5 h-5" /> },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col bg-slate-50 border-r border-slate-200">
      {/* Logo/Header */}
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-slate-900">Medi-Diagnoser</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }
              `}
            >
              <span className={isActive ? 'text-teal-600' : 'text-slate-500 group-hover:text-slate-700'}>
                {item.icon}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4">
        <div className="text-xs text-slate-500">
          <p className="font-medium text-slate-700">HIPAA Compliant</p>
          <p className="mt-1">Secure • Private • Encrypted</p>
        </div>
      </div>
    </div>
  );
}

