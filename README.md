Chatbot municipal (demo piloto) — Next.js + Prisma + PostgreSQL + Anthropic (Claude Haiku 4.5).

## Setup

1. Copiá `.env.example` a `.env` y completá `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET`.
2. Aplicá el schema a la base: `npx prisma migrate dev --name init`
3. Cargá las FAQs de ejemplo: `npm run db:seed`
4. Corré el server: `npm run dev`

- Chat: `POST /api/chat` con `{ "message": string, "conversationId"?: string, "citizenContact"?: string }`
- Panel admin: `/admin` (pide la clave de `ADMIN_PASSWORD`) — pestaña "Casos" y pestaña "Configuración"
- WhatsApp: en `/admin/config`, botón "Conectar WhatsApp" muestra un QR (vía [Baileys](https://github.com/WhiskeySockets/Baileys), no oficial) para vincular el número que va a atender el chat. La sesión se guarda en `./whatsapp-auth/` (gitignored).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

**No usar hosting serverless (Netlify, Vercel, Cloudflare Pages/Workers).** El conector de WhatsApp (`lib/whatsapp/baileys-client.ts`) mantiene un WebSocket abierto de forma indefinida y guarda la sesión en disco local (`./whatsapp-auth/`) — ambas cosas requieren un **proceso Node.js persistente** con **disco persistente**, algo que el modelo serverless no ofrece (cada función se crea y se destruye por request). Sin eso, la conexión de WhatsApp se cortaría constantemente y habría que re-escanear el QR todo el tiempo.

Usar en cambio un hosting de "servicio persistente": **Railway**, **Render** (plan pago, como Web Service) o **Fly.io**. El free tier de Render en particular NO sirve para este proyecto: se duerme por inactividad (mata el WebSocket de WhatsApp) y no ofrece disco persistente (se pierde la sesión en cada redeploy).

### Deploy en Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → elegí `Thewoker/muni-cha-bot`. Railway detecta Next.js automáticamente (Nixpacks) y corre `npm run build` + `npm start`.
2. En el mismo proyecto: **New** → **Database** → **PostgreSQL**. Railway crea el servicio y expone `DATABASE_URL` como variable — en el servicio web, referenciala como `${{Postgres.DATABASE_URL}}` (o copiá el valor a mano) en vez de escribir una fija.
3. En el servicio web, pestaña **Variables**, cargá: `DATABASE_URL` (del paso 2), `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.
4. Pestaña **Settings** → **Volumes** → **Add volume**, mount path `/app/whatsapp-auth`. Sin esto, cada redeploy borra la sesión de WhatsApp y hay que volver a escanear el QR.
5. Start command ya viene resuelto por `package.json` (`prisma migrate deploy && next start`) — las migraciones se aplican solas en cada deploy, no hace falta correrlas a mano.
6. Deployeá, esperá a que el servicio quede "Active", entrá a `https://<tu-dominio-railway>/admin/config` y escaneá el QR una sola vez — con el volumen persistente, sobrevive a los redeploys.

Con esto, el resto de la app (chat web, panel admin, Prisma/Postgres, notificaciones por email) funciona exactamente igual que en local.
