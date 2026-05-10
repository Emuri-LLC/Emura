# Emura — Project Context

## What this is
Emura manufacturing cost estimator for contract manufacturers. 
Allows estimators to quote BOM costs, direct labor, indirect 
labor, and subcontracts across multiple finished goods and 
volume breaks. Outputs cost per unit and sell price per FG 
per volume break.

## Business
- Company: Emuri, LLC
- Product: Emura
- Owner: Ethan Meyers (ebmeyers on GitHub)
- Stage: Converting prototype to hosted SaaS

## URLs
- Production: https://emura.io
- Vercel preview: https://emura-olive.vercel.app
- GitHub: https://github.com/Emuri-LLC/Emura

## Local development
- Project folder: /Users/eohano/Emuri/Emura
- Run dev server: npm run dev (once Next.js is set up)
- Local URL: http://localhost:3000

## Tech stack
- Frontend: Next.js (React)
- Hosting: Vercel (auto-deploys on git push to main)
- Database + Auth: Supabase
- Payments: Stripe
- Domain registrar: Namecheap

## Current state
- Working prototype: index.html (kept for reference, not deployed)
- Spec document: manufacturing-cost-estimator-spec.html
- Active app: emura-app/ (Next.js, deployed to emura.io via Vercel)
- Phase 2 in progress: app running in Next.js as single component
- Next step: extract calculation engine into lib/calculations.ts

## Project phases
- ✅ Phase 0: Environment setup
- ✅ Phase 1: Get something live on Vercel
- 🔄 Phase 2: Convert to Next.js project structure
- Phase 3: Add Supabase authentication
- Phase 4: Cloud save/load (replace localStorage)
- Phase 5: Organizations and sharing
- Phase 6: Launch prep (Stripe, custom domain, email)

## Design principles
- Emura's mission is to be the fastest, easiest, and most accurate cost estimating software for manufacturing environments.  We will be the cost estimator's favorite tool by being the easiest, fastest, and most user friendly.  We will be the sales team's favorite tool by providing clear, comprehensive, and meaningful data explaining costs and pricing.  We will be the engineering team's favorite tool by making it easy to build and update BOMs and BOOs to reflect early-stage opportunities. 
- Speed is a feature. All calculations run client-side.
  Never make a network call during user interaction.
- No unnecessary dependencies. Fight bundle size.
- Save asynchronously, never block the UI.
- Keep localStorage as a backup even after Supabase is added.
- No pop-ups or warnings ever, except for deleting an entire quote.  Instead of slowing users down, allow them to undo and go backwards.

## Key files
- index.html: current working prototype (do not break this)
- manufacturing-cost-estimator-spec.html: product specification

## Conventions (to be updated as Next.js is set up)
- TBD