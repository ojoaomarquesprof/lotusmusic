# Lotus Music — Sistema de Gestão Escolar

Sistema administrativo desenvolvido para organizar a rotina de uma escola de música, centralizando informações de alunos, professores, aulas e processos internos em uma plataforma digital.

O projeto nasceu de uma necessidade real de gestão da Lotus Music, com foco em melhorar a organização operacional, facilitar o acompanhamento dos alunos e trazer mais clareza para a administração da escola.

---

## Objetivo

Criar uma aplicação web para auxiliar na gestão de uma escola de música, reduzindo controles manuais e reunindo em um único sistema as principais informações utilizadas no dia a dia.

A proposta do sistema é oferecer uma base administrativa para controle de alunos, professores, aulas, organização interna e fluxo de gestão escolar.

---

## Principais funcionalidades

- Cadastro e organização de alunos
- Gestão de professores
- Controle de aulas
- Painel administrativo
- Organização de dados escolares
- Fluxo de gestão interna
- Interface responsiva
- Estrutura preparada para evolução do sistema

---

## Stack utilizada

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Git
- GitHub
- Vercel

---

## Diferenciais técnicos

- Estrutura full stack com Next.js
- Organização de componentes reutilizáveis
- Interface responsiva com Tailwind CSS
- Integração com Supabase
- Modelagem de dados com PostgreSQL
- Separação de responsabilidades entre interface, lógica e dados
- Projeto baseado em uma necessidade real de negócio

---

## Aprendizados

Durante o desenvolvimento deste projeto, aprofundei conhecimentos em:

- Estruturação de aplicações web com Next.js
- Criação de interfaces administrativas
- Organização de dados para sistemas internos
- Integração com banco de dados
- Componentização com React
- Boas práticas com TypeScript
- Deploy de aplicações web

---

## Como rodar localmente

Clone o repositório:

```bash
git clone https://github.com/ojoaomarquesprof/lotusmusic.git
```

Acesse a pasta do projeto:

```bash
cd lotusmusic
```

Instale as dependências:

```bash
npm install
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Depois acesse:

```bash
http://localhost:3000
```

---

## Variáveis de ambiente

Caso o projeto utilize Supabase ou outros serviços externos, crie um arquivo `.env.local` na raiz do projeto com as variáveis necessárias.

Exemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=

# Opcionais: emissão automática pelo Asaas
ASAAS_ENVIRONMENT=sandbox
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
```

As chaves reais não devem ser versionadas no repositório.

---

## Modelos de faturamento

O cadastro do aluno permite escolher entre:

- **Créditos:** cada pagamento confirmado libera 4 créditos e cada aula realizada consome 1.
- **Mês fechado:** soma as aulas realizadas no mês, fecha no último dia e gera uma fatura com vencimento em 7 dias corridos.
- **Vencimento fixo:** mantém a mensalidade convencional e créditos de reposição válidos por 30 dias.

Antes de publicar essa funcionalidade, execute no Supabase a migração:

```text
supabase/migrations/202608040001_modelos_faturamento.sql
supabase/migrations/202608040002_faturas_detalhadas.sql
supabase/migrations/202608040003_cancelamento_faturas.sql
```

Para habilitar o cadastro rápido, a presença e a conversão de aulas experimentais em matrícula, execute também:

```text
supabase/migrations/202608100001_aulas_experimentais.sql
```

A rotina de fechamento roda diariamente pela Vercel e processa o mês anterior logo após a virada para o primeiro dia. Assim, inclui todas as aulas do último dia; a fatura mantém a data de emissão do mês encerrado e vence 7 dias depois. A rotina é protegida por `CRON_SECRET` e não duplica faturas em reexecuções.

No perfil do aluno, o botão **Gerar fatura** permite selecionar a qualquer momento as aulas realizadas que ainda não foram cobradas, ajustar o valor por aula e definir o vencimento. Cada aula só pode pertencer a uma fatura, evitando cobranças duplicadas. A visualização detalhada inclui data, horário, modalidade, professor, valor, dados do aluno e dados da escola.

Preencha os dados do emitente em **Financeiro → Configurações** antes de gerar a primeira fatura definitiva. A fatura guarda uma cópia dessas informações no momento da emissão.

A fatura foi preparada para impressão compacta em uma única página A4. Faturas ainda não pagas e sem cobrança externa podem ser canceladas pelo administrador; nesse caso, os itens são removidos e as aulas retornam automaticamente para a lista de pendências. Faturas pagas não podem ser canceladas.

Para emissão automática:

1. crie uma conta e uma chave no sandbox do Asaas;
2. configure as variáveis `ASAAS_*` na Vercel;
3. cadastre o webhook `https://SEU-DOMINIO/api/webhooks/asaas`;
4. assine os eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED` e `PAYMENT_REFUNDED`.

Sem credenciais do Asaas, o sistema cria a fatura interna e permite a cobrança manual por PIX/WhatsApp.

---

## Status do projeto

Projeto em desenvolvimento contínuo.

Novas funcionalidades podem ser adicionadas conforme a evolução das necessidades administrativas da escola.

---

## Autor

Desenvolvido por **João Marques**.

- GitHub: [@ojoaomarquesprof](https://github.com/ojoaomarquesprof)
- LinkedIn: [João Marques](https://www.linkedin.com/in/jo%C3%A3o-marques-332709417/)
