# Phase 2 Setup Guide — Project Skeleton

Goal: get the React app running on your laptop so you can see a placeholder
page in your browser. After this phase you'll have a real, runnable codebase.

## What you'll do in this phase

1. Install VS Code (the editor)
2. Install git (for version control)
3. Pick a folder for the project and copy the files there
4. Run `npm install` to download dependencies
5. Add your Supabase credentials to a `.env` file
6. Run `npm run dev` and confirm the placeholder page loads

You already have Node and npm — that was the prerequisite for this phase.

---

## Step 1 — Install VS Code (if you don't have it)

VS Code is free and is the most common editor for this stack.

1. Go to [https://code.visualstudio.com/](https://code.visualstudio.com/) and click **Download for Mac**.
2. Open the `.zip` file. Drag the **Visual Studio Code** app into your **Applications** folder.
3. Open VS Code from your Applications folder. The first time you launch it,
   macOS will ask "Are you sure?" — click **Open**.

When VS Code is open, install two extensions that will make life much easier:

1. Click the **Extensions** icon in the left sidebar (looks like four squares with one detaching).
2. Search for **`Tailwind CSS IntelliSense`** by Tailwind Labs and click **Install**.
3. Search for **`ES7+ React/Redux/React-Native snippets`** by dsznajder and click **Install**.

These extensions auto-complete Tailwind class names and React boilerplate as
you type. Not strictly required, but very helpful.

## Step 2 — Install git (if you don't have it)

1. Open Terminal and run:

   ```
   git --version
   ```

2. If you see a version number — done, skip to Step 3.
3. If you see "command not found" or macOS prompts you to install Command Line
   Tools, **click Install** on the prompt and wait a few minutes for it to
   finish. After the install, run `git --version` again to confirm.

## Step 3 — Pick a folder and put the project files there

I'd suggest something like `~/Code/amta-crm/` (the `~` is shorthand for your
home folder). Create it if you don't already have a `~/Code/` folder:

```
mkdir -p ~/Code
cd ~/Code
```

Now copy **all** the files from the `amta-crm-app` folder I gave you into
`~/Code/amta-crm/`. The easiest way:

1. Open Finder.
2. Navigate to wherever you downloaded the project files (probably your
   Downloads folder).
3. **Copy** the entire `amta-crm-app` folder into `~/Code/`.
4. **Rename** it from `amta-crm-app` to `amta-crm` (right-click → Rename).
   (Optional — the folder name doesn't matter to the code.)

Now in Terminal, navigate into the project:

```
cd ~/Code/amta-crm
```

Confirm you're in the right place by listing the files:

```
ls
```

You should see things like `package.json`, `vite.config.ts`, `src`, etc.

## Step 4 — Initialize git (good habit)

Still in `~/Code/amta-crm`:

```
git init
git add .
git commit -m "Initial Phase 2 commit"
```

This creates a local git repository and makes your first commit. From now on,
any time you finish a chunk of work, `git add . && git commit -m "what I did"`
will save a snapshot you can roll back to. We won't push to GitHub yet —
that's for the deploy phase.

## Step 5 — Install dependencies

Still in `~/Code/amta-crm`:

```
npm install
```

This downloads everything listed in `package.json` (React, Vite, Tailwind,
Supabase client, etc.) into a `node_modules/` folder. Takes about 1-2 minutes
and prints a wall of text. As long as no big red `ERROR` appears at the end,
you're good.

You may see warnings about "deprecated" packages — those are normal and harmless.

## Step 6 — Set up your environment file

Open VS Code and open the project folder:

```
code .
```

(That command opens VS Code in the current folder. If `code` isn't recognized,
open VS Code manually, then **File → Open Folder…** and pick `~/Code/amta-crm`.)

In VS Code's file explorer (left sidebar), you'll see `.env.example`. We need
to create a real `.env` from it:

1. In Terminal, still inside the project folder, run:

   ```
   cp .env.example .env
   ```

2. In VS Code, open the new `.env` file.
3. Paste the **Project URL** from your Supabase project after `VITE_SUPABASE_URL=`.
4. Paste the **anon public key** from your Supabase project after `VITE_SUPABASE_ANON_KEY=`.

The file should look something like (don't use these example values):

```
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi...
```

No quotes, no spaces around the `=`.

Save the file (Cmd+S).

## Step 7 — Run the dev server

In Terminal:

```
npm run dev
```

You should see output like:

```
  VITE v5.4.x  ready in 423 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

Your browser should automatically open to `http://localhost:5173/`. If it
doesn't, copy that URL into your browser manually.

You should see:

- A small maroon-tinted icon at the top
- The title **"AMTA CRM"**
- A short message confirming the toolchain works
- A small **"Phase 2 complete"** badge at the bottom

If you see that page, **Phase 2 is done.** 🎉

The dev server keeps running in your terminal. Edit any `.tsx` file and the
browser auto-reloads with your changes — that's Vite's hot module reload.
Press **Ctrl+C** in the terminal to stop the server when you're done.

## Troubleshooting

### "command not found: npm" or "command not found: code"
Close every terminal window and open a fresh one. Newly-installed tools
sometimes need a fresh shell to be picked up.

### `npm install` fails with permission errors
Don't run `sudo npm install` — that creates more problems than it solves.
Instead, double-check that nvm is properly set up: run `which node` and you
should see a path like `~/.nvm/versions/node/v20.x.x/bin/node`. If you see
`/usr/local/bin/node` or `/usr/bin/node`, you're using a system Node and
should switch to nvm's. Run `nvm use 20` and retry.

### Browser opens but page is blank
Open the browser's DevTools (Cmd+Option+I), look at the Console tab. If you
see something about "Missing Supabase URL", you forgot to fill in the `.env`
file. If you see another error, send me the exact text.

### "Cannot find module @/..." errors in VS Code
VS Code occasionally needs a restart after the project's TypeScript config is
created. Close VS Code completely and reopen it.

### Port 5173 is already in use
Another app is already on that port. Easiest fix: stop the other app. Or
change the port in `vite.config.ts` to e.g. 5174.

### The page loads but the icon and styling look "off"
Tailwind isn't being applied. Stop the dev server (Ctrl+C in the terminal),
then run `npm run dev` again. If it persists, check that
`postcss.config.js` and `tailwind.config.ts` both exist in the project root.

## What's next

When you're seeing the placeholder page in your browser, ping me and I'll
start Phase 3 — wiring Supabase auth and data fetching. That phase will give
you a real login screen and a working data layer (still empty UI, but with
real reads/writes against your database).
