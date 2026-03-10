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
      
      <body className={`${inter.className} min-h-screen w-full text-slate-900 flex flex-col overflow-x-hidden relative selection:bg-indigo-500/30`}>
        
        {/* 👇 O SEGREDO DO GLASSMORPHISM: Fundo com formas coloridas suaves e muito desfoque */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-slate-50">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-indigo-300/30 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-cyan-300/30 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute top-[20%] right-[10%] w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] rounded-full bg-purple-300/20 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
        </div>

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