# Put Beat the Clock online (free, Render)

## 1. Put the folder on GitHub
1. Make a free account at github.com and click New repository. Name it beat-the-clock. Set it to Public (Render's free plan is easiest with a public repo). Create it empty.
2. Install Git (git-scm.com) if you don't have it. Open a terminal inside this folder and paste:

   git init
   git add .
   git commit -m "Beat the Clock"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/beat-the-clock.git
   git push -u origin main

   (Replace YOUR-USERNAME. A browser window asks you to log in.)

   No Git? On the repo page use Add file > Upload files. GitHub accepts about 100 files per upload, so send index.html, server.js, package.json, categories.json first, then the images folder in batches of up to 100 photos.

## 2. Create the web service on Render
1. Make a free account at render.com and sign in with GitHub.
2. New + > Web Service > pick your beat-the-clock repo.
3. Settings: Runtime Node. Build Command: leave empty. Start Command: node server.js. Instance Type: Free.
4. Click Create Web Service. After a couple of minutes you get a link like https://beat-the-clock-xxxx.onrender.com. That is your game.

## Good to know
- Free Render goes to sleep after about 15 minutes with no visitors. The next person waits around a minute for it to wake. Open the link a few minutes before a stream.
- Rooms live in memory, so if the server restarts or sleeps, open rooms disappear. Make a new room.
- Room codes are 4 digits. Use streamer mode on stream so viewers can't read the code.
- The photos are other people's work. Fine for private testing; before a public launch, check each photo's licence (Wikimedia Commons lists it, and many need credit).
