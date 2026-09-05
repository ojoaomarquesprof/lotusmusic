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
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="theme-color" content="#13251f" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        
      </head>
      
      <body className={`${inter.className} lotus-root min-h-screen w-full text-slate-900 flex flex-col overflow-x-hidden relative`}>
        
        {/* 👇 O SEGREDO DO GLASSMORPHISM: Fundo com formas coloridas suaves e muito desfoque */}
        <div className="app-backdrop fixed inset-0 pointer-events-none -z-10" />

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
