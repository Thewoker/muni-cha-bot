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

Usar en cambio un hosting de "servicio persistente": **Railway**, **Render** (como Web Service, no como Static Site) o **Fly.io**. Los tres detectan Next.js automáticamente (Nixpacks/buildpacks) y corren `npm run build` + `npm start` en un contenedor que queda vivo. Pasos (ejemplo con Railway, los otros son análogos):

1. Creá el servicio apuntando a este repo.
2. Agregá un servicio de **PostgreSQL administrado** (Railway/Render lo ofrecen con un click) y copiá su `DATABASE_URL` a las variables de entorno del servicio web.
3. Cargá el resto de las variables: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.
4. Montá un **volumen persistente** en `/app/whatsapp-auth` (Railway: "Volumes"; Render: "Disks"). Sin esto, cada redeploy borra la sesión de WhatsApp y hay que volver a escanear el QR.
5. Build command: `npm run build` (o dejalo automático). Start command: `npm start` — ya corre `prisma migrate deploy` antes de levantar el server (ver `package.json`), así que las migraciones se aplican solas en cada deploy.
6. Deployeá, entrá a `/admin/config` y escaneá el QR una sola vez — con el volumen persistente, sobrevive a los redeploys.

Con esto, el resto de la app (chat web, panel admin, Prisma/Postgres, notificaciones por email) funciona exactamente igual que en local — no depende de nada serverless-incompatible.
