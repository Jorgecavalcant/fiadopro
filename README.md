# FiadoPro

Mobile-first credit management app for small business owners in Brazil.
Track customers who buy on credit ("fiado"), register payments, and manage your receivables.

**Live:** https://fiadopro.jcplanejamento.com.br

---

## Stack

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Storage:** localStorage (client-side)
- **Deploy:** Docker + Nginx on Hetzner VPS

## Project Structure

```
fiado-pro/
├── frontend/          # React app (Vite)
│   ├── src/
│   │   ├── App.tsx            # Main app + all view components
│   │   ├── types/index.ts     # TypeScript types and enums
│   │   ├── components/
│   │   │   └── Layout.tsx     # Sidebar + header layout
│   │   └── translations/      # i18n (pt-BR, en)
│   └── dist/                  # Built output (served by Nginx)
├── dist/              # Nginx serves from here (symlinked/copied from frontend/dist)
├── docker-compose.yml
├── nginx.conf
└── CHANGELOG.md
```

## Development

```bash
cd frontend
npm install
npm run dev       # Local dev server
npm run build     # Production build → ../dist/
```

## Deploy

```bash
cd frontend && npm run build && docker restart fiado-pro-web
```

## Plans

| Feature             | Free | PRO  |
|---------------------|------|------|
| Max customers       | 20   | 500  |
| Max events          | 3    | ∞    |
| AI Insights         | No   | Yes  |
| Ads                 | Yes  | No   |

## Support

suportejc.planejamento@gmail.com
