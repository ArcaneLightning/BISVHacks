# Deploy CrisisBridge to Vercel

## 1. Push your code to GitHub

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## 2. Import project on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (or create an account)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js — no config changes needed

## 3. Add environment variables

In your Vercel project: **Settings** → **Environment Variables**. Add:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `FEATHERLESS_API_KEY` | Featherless AI API key |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `DISPATCHER_ACCESS_CODE` | Secret code for dispatcher login |

Copy values from your `.env.local` (never commit these).

## 4. Deploy

Click **Deploy**. Vercel will build and deploy. Your app will be live at `https://your-project.vercel.app`.

## 5. Configure Supabase for production

In Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://your-project.vercel.app`
- **Redirect URLs**: Add `https://your-project.vercel.app/**` and `https://your-project.vercel.app/auth/callback`

## Optional: Deploy via CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts, then add env vars in the Vercel dashboard.
