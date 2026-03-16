"use client"

import { motion } from 'framer-motion'

// Array de Cursos: Configure "usarImagem: true" e coloque os PNGs sem fundo na pasta public/icones/
const cursos = [
  { nome: 'Canto', emoji: '🎤', imagem: '/icones/canto.png', usarImagem: false },
  { nome: 'Violão', emoji: '🎸', imagem: '/icones/violao.png', usarImagem: false },
  { nome: 'Guitarra', emoji: '⚡', imagem: '/icones/guitarra.png', usarImagem: false },
  { nome: 'Teclado', emoji: '🎹', imagem: '/icones/teclado.png', usarImagem: false },
  { nome: 'Piano', emoji: '🎼', imagem: '/icones/piano.png', usarImagem: false },
  { nome: 'Baixo', emoji: '🎸', imagem: '/icones/baixo.png', usarImagem: false },
  { nome: 'Bateria', emoji: '🥁', imagem: '/icones/bateria.png', usarImagem: false },
  { nome: 'Viola Caipira', emoji: '🪕', imagem: '/icones/viola.png', usarImagem: false },
  { nome: 'Sanfona', emoji: '🪗', imagem: '/icones/sanfona.png', usarImagem: false },
  { nome: 'Cavaco', emoji: '🪕', imagem: '/icones/cavaco.png', usarImagem: false },
  { nome: 'Violino', emoji: '🎻', imagem: '/icones/violino.png', usarImagem: false },
  { nome: 'Ukulele', emoji: '🏝️', imagem: '/icones/ukulele.png', usarImagem: false },
]

// Variantes de animação do Framer Motion
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

export default function LotusLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-hidden">
      
      {/* BACKGROUND ANIMADO (Luzes de fundo vítreas) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }} 
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-cyan-900/20 blur-[120px]"
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.2, 0.1] }} 
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-emerald-900/20 blur-[150px]"
        />
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-lg border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 cursor-default">
            LÓTUS<span className="text-slate-100 not-italic font-bold">MUSIC</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="hidden md:flex gap-8 text-sm font-bold uppercase tracking-widest text-slate-400">
            <a href="#metodologia" className="hover:text-cyan-400 transition-colors">Metodologia</a>
            <a href="#cursos" className="hover:text-cyan-400 transition-colors">Cursos</a>
            <a href="#app" className="hover:text-emerald-400 transition-colors">App Exclusivo</a>
          </motion.div>
          <motion.a 
            href="/login"
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            className="px-6 py-2.5 rounded-full bg-white text-slate-950 font-black text-xs uppercase tracking-widest hover:bg-cyan-400 transition-colors shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
          >
            Área do Aluno
          </motion.a>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-20">
        
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="max-w-4xl">
            <motion.div variants={fadeUp} className="inline-block mb-6 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-sm shadow-inner">
              <span className="text-cyan-300 text-xs font-bold uppercase tracking-widest">A revolução do ensino musical</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.1] text-white mb-8">
              Aprenda música com <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-300% animate-pulse">
                tecnologia e propósito.
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
              Esqueça os métodos engessados. Na Lótus, unimos uma metodologia inovadora a um aplicativo exclusivo para acelerar sua evolução real.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] transition-all">
                Agendar Aula Experimental
              </motion.button>
              <motion.a href="#cursos" whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-all backdrop-blur-sm flex items-center justify-center">
                Conhecer os Cursos
              </motion.a>
            </motion.div>
          </motion.div>
        </section>

        {/* SESSÃO DO APLICATIVO (Mockup em CSS) */}
        <section id="app" className="max-w-7xl mx-auto px-6 py-24">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
            className="relative rounded-[3rem] bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 md:p-16 overflow-hidden flex flex-col md:flex-row items-center gap-12 shadow-2xl"
          >
            {/* Brilho interno do card */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="flex-1 relative z-10">
              <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
                A sua escola, <br/><span className="text-emerald-400">no seu bolso.</span>
              </h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                Nossos alunos têm acesso a um <strong>Aplicativo Próprio</strong> exclusivo. Esqueça mensagens perdidas no WhatsApp ou falta de acompanhamento.
              </p>
              <ul className="space-y-5">
                {[
                  "Acompanhe sua evolução e diário de aulas.",
                  "Solicite remarcações e reposições com 1 clique.",
                  "Acesse materiais de estudo, cifras e áudios.",
                  "Gestão financeira automatizada e transparente."
                ].map((item, i) => (
                  <motion.li 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 + 0.3 }}
                    className="flex items-start gap-4 text-slate-300 font-medium"
                  >
                    <span className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs font-bold shadow-inner">✓</span>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </div>
            
            {/* Mockup do Celular Animado */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
              className="flex-1 w-full flex justify-center perspective-[1000px] mt-10 md:mt-0"
            >
              <motion.div 
                animate={{ y: [-15, 15, -15], rotateY: [-15, -10, -15], rotateX: [5, 8, 5] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-64 md:w-72 h-[500px] rounded-[3rem] border-[8px] border-slate-800 bg-slate-950 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                {/* Interface Falsa do App */}
                <div className="w-full h-full p-5 flex flex-col gap-4 bg-slate-900 relative">
                  {/* Top bar fake */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
                      <div className="w-16 h-2 rounded-full bg-slate-700" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-800" />
                  </div>
                  {/* Card principal */}
                  <div className="w-full h-32 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex flex-col justify-end p-4">
                     <div className="w-24 h-3 rounded-full bg-white/50 mb-2" />
                     <div className="w-16 h-2 rounded-full bg-white/30" />
                  </div>
                  {/* Grid de botões */}
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="w-full h-24 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center"><div className="w-8 h-8 rounded-full bg-slate-700" /></div>
                    <div className="w-full h-24 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center"><div className="w-8 h-8 rounded-full bg-slate-700" /></div>
                    <div className="w-full h-24 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center"><div className="w-8 h-8 rounded-full bg-slate-700" /></div>
                    <div className="w-full h-24 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center"><div className="w-8 h-8 rounded-full bg-slate-700" /></div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        {/* SESSÃO DE CURSOS (GRID INTERATIVO COM ÍCONES) */}
        <section id="cursos" className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16 relative">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-4xl md:text-5xl font-black text-white mb-4">
              Escolha seu <span className="text-cyan-400">Instrumento</span>
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-slate-400 text-lg">
              Qualquer que seja o seu estilo, temos o curso perfeito para você.
            </motion.p>
          </div>

          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 relative z-10"
          >
            {cursos.map((curso, index) => (
              <motion.div 
                key={curso.nome} variants={fadeUp}
                whileHover={{ scale: 1.03, y: -5 }}
                className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-cyan-500/50 p-6 md:p-8 rounded-3xl transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center shadow-lg h-full"
              >
                {/* Efeito de luz no hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Renderiza a imagem realista se ativado, senão renderiza o emoji */}
                <div className="flex items-center justify-center h-20 md:h-24 mb-4 transform group-hover:scale-110 transition-transform duration-300">
                  {curso.usarImagem ? (
                    <img 
                      src={curso.imagem} 
                      alt={`Ícone de ${curso.nome}`} 
                      className="h-full w-auto object-contain drop-shadow-2xl"
                    />
                  ) : (
                    <span className="text-5xl md:text-6xl drop-shadow-lg opacity-90">{curso.emoji}</span>
                  )}
                </div>
                
                <h3 className="text-lg md:text-xl font-bold text-slate-200 group-hover:text-cyan-300 transition-colors mt-auto tracking-tight">
                  {curso.nome}
                </h3>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* SESSÃO PROFESSOR / FUNDADOR */}
        <section id="metodologia" className="max-w-7xl mx-auto px-6 py-24">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="rounded-[3rem] bg-slate-900/80 backdrop-blur-md border border-slate-800 p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-20 relative overflow-hidden shadow-2xl"
          >
             {/* Letra L decorativa gigante no fundo */}
             <div className="absolute -bottom-10 -left-10 text-[20rem] opacity-[0.03] text-white pointer-events-none select-none font-serif italic leading-none">
               L
             </div>

            {/* Foto Elegante */}
            <div className="w-full lg:w-2/5 relative">
              <motion.div 
                whileHover={{ scale: 1.02 }} transition={{ duration: 0.4 }}
                className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/10 shadow-2xl z-10"
              >
                {/* Substitua o SRC pela sua foto real na pasta public (ex: /images/joao.jpg) */}
                <img 
                  src="https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=2070&auto=format&fit=crop" 
                  alt="João Marques" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="text-white font-black text-3xl tracking-tight">João Marques</p>
                  <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mt-1">Diretor e Professor</p>
                </div>
              </motion.div>
              
              {/* Moldura de fundo */}
              <div className="absolute -inset-4 border border-slate-700/50 rounded-3xl -z-10 translate-x-4 translate-y-4" />
            </div>

            {/* Texto/Bio */}
            <div className="w-full lg:w-3/5 relative z-10">
              <h2 className="text-3xl md:text-5xl font-black text-white mb-8 leading-tight">
                Metodologia assinada por quem <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">vive a música.</span>
              </h2>
              <div className="space-y-6 text-slate-400 text-lg leading-relaxed font-medium">
                <p>
                  A Lótus Music não nasceu para ser apenas mais uma escola. Ela nasceu da necessidade de modernizar o ensino, unindo a paixão pela arte com a eficiência da tecnologia de ponta.
                </p>
                <p>
                  Como músico, desenvolvedor e educador, percebi que o maior gargalo dos alunos não era a falta de talento, mas a falta de um acompanhamento estruturado fora da sala de aula. Foi por isso que criamos nosso ecossistema e portal exclusivos.
                </p>
                <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800 relative mt-8">
                  <span className="text-4xl absolute -top-4 -left-2 text-cyan-500/30 font-serif">"</span>
                  <p className="text-slate-300 italic text-base md:text-lg relative z-10">
                    Nosso compromisso é fazer com que cada minuto do seu estudo traga resultados reais. Aqui, você não apenas toca, você entende o que está fazendo e acompanha seu próprio crescimento.
                  </p>
                </div>
              </div>

              <motion.a href="https://wa.me/SEUNUMEROAQUI" target="_blank" whileHover={{ x: 10 }} className="mt-8 inline-flex items-center gap-3 text-cyan-400 font-bold uppercase tracking-widest text-sm hover:text-cyan-300 transition-colors group">
                Falar com o Professor 
                <span className="transform group-hover:translate-x-2 transition-transform">→</span>
              </motion.a>
            </div>
          </motion.div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-slate-950 pt-16 pb-8 text-center md:text-left relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 mb-4 cursor-default">
              LÓTUS<span className="text-slate-100 not-italic font-bold">MUSIC</span>
            </div>
            <p className="text-slate-500 max-w-sm mx-auto md:mx-0 font-medium">
              A revolução do ensino musical. Tecnologia, método e paixão trabalhando juntos pelo seu talento.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-4">Contato</h4>
            <ul className="space-y-3 text-slate-400 text-sm font-medium">
              <li>(43) 99999-9999</li> {/* Atualize com seu número de Londrina/Cambé */}
              <li>contato@lotusmusic.com.br</li>
              <li>Cambé - PR</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-4">Redes Sociais</h4>
            <ul className="space-y-3 text-slate-400 text-sm font-medium">
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Instagram</a></li>
              <li><a href="#" className="hover:text-cyan-400 transition-colors">YouTube</a></li>
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Facebook</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 text-center text-slate-600 text-xs font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} Lótus Music. Desenvolvido por Sonus Prime.
        </div>
      </footer>
    </div>
  )
}