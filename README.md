# Nusa SF

One site with three connected parts:

- `index.html`: the website. Customers order, get their own order page that updates by itself, and chat with Nusa ("Ask Nusa" bubble, and a chat on every order page). Catering requests send for real.
- `dashboard/index.html`: the owner dashboard at `/dashboard`. Password `nusa2026`.
- `api/` and `lib/`: the small server part that keeps everything in one shared database.
- `img/` and `fonts/`: compressed photos and the Brygada 1918 font, served from the site itself so pages load fast.

## Put it live on Vercel

1. Push this folder to a GitHub repo and import it in Vercel (no build settings needed).
2. In the Vercel project, go to Storage, create a Neon Postgres database and click Connect.
3. Redeploy. The dashboard's top bar then says "Live on all devices".

Without a database, it still works, but only inside one browser (the bar says "This browser only").

## Optional

- Change the dashboard password: add `NUSA_STAFF_KEY` in Vercel's Environment Variables.
- "Reset sample data" at the bottom of the dashboard puts the demo orders back for everyone.

Not included: online payment and text messages to customers. Customers pay at pickup or delivery.
