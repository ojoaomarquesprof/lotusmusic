"use client"

import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '../components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <title>Lótus Music</title>
        <meta name="description" content="Sistema de Gestão Lótus Music" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      
      {/* Devolvemos as classes de segurança para não quebrar o layout base */}
      <body className={`${inter.className} min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden`}>
        
        <Sidebar>
          {children}
        </Sidebar>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('App Lótus Pronto: ', registration.scope);
                  }, function(err) {
                    console.log('Erro no App: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}