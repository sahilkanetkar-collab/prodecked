# ProDecked — Wave 1

A static website: plain HTML, CSS and JavaScript with no server, no database and no build step. Every tool runs in the visitor's browser.

## What's inside

- `index.html`: the homepage, with the tool grid, the "For teachers" section, the privacy explainer and the FAQ
- 17 tool pages, one per tool (for example `compress-ppt.html`, `mcq-to-quiz-ppt.html`)
- `studio.html`: the full Deck Studio with every setting, reskinned as ProDecked Studio
- `privacy.html`, `404.html`, `sitemap.xml`, `robots.txt`, `vercel.json`
- `assets/`: styles, self-hosted fonts, the engine and the tool code

## Put it live on Vercel (same route as campverbal.com)

1. On GitHub, create a new repository called `prodecked`.
2. Upload everything in this folder to it: the `.html` files, `assets/`, `vercel.json`, `sitemap.xml` and `robots.txt`.
3. On Vercel, click **Add New → Project**, import `prodecked`, leave every setting as it is and click **Deploy**.
4. Under **Settings → Domains**, add `prodecked.com` (or whichever domain you bought). Vercel shows two DNS records to add at Porkbun.
5. Optional: under **Analytics**, turn on Web Analytics. It needs no cookies, which matches the privacy page.

`vercel.json` turns on clean URLs, so `prodecked.com/compress-ppt` works without `.html`.

## If the domain isn't `prodecked.com`

Ask Claude to switch the domain. Every page, the sitemap and the privacy email use `https://prodecked.com` and `hello@prodecked.com`, so one find-and-replace across the folder is all it takes.

## Tools in Wave 1

| Group | Tools |
|---|---|
| Create from questions | MCQ to Quiz Deck · Shuffle Question Sets · Question Paper PDF |
| Teach with your slides | Add Answer Reveals · Countdown Timer · Animate Bullets · Make Text Bigger |
| Polish a deck | Add Slide Numbers · Watermark or Logo · Add Transitions · Background & Theme |
| Fix and clean | Compress PPT · Repair PPT · Remove Animations · Clean Before Sharing |
| Extract | Extract Images · PPT to Text |

The homepage lists these as coming soon: Merge PPTs, PDF to PPT, Flashcard Deck, Certificate Maker, Deck to Online Test, PPT to PDF or Video, Translate a Deck and Answer-Key Checker.
