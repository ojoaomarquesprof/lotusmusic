"use client"

import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '../components/Sidebar' // Importando seu componente responsivo

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
        
        {/* PODERES DE APLICATIVO (PWA) */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      
      {/* Removemos o bg-slate-50 fixo daqui. O Sidebar.tsx assumirá as cores dinâmicas. */}
      <body className={inter.className}>
        
        <Sidebar>
          {children}
        </Sidebar>

        {/* MOTOR INVISÍVEL DO PWA */}
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