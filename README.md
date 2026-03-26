# ArcherPhish

This repo will store the code, documentation, and deliverables for Group 55's Capstone Project, ArcherPhish

## **<ins>Core Features</ins>**
1. User login 

2. Send phishing simulation emails

3. Track  recipient actions
    - Links clicked
    - Flagged/Reported
    - Other interactions like replies

4. Dashboard/Stats
    - Statistics of deliveries, opens, clicks, flags, etc
    - Display charts (Optional)

## Getting Started (Backend)

1. Copy `backend/.env.sample` to `backend/.env` and fill in real values. The most important
   variable is `DATABASE_URL` which should look like:

   - By default the project will fall back to a lightweight SQLite database at
     `backend/dev.db` if `DATABASE_URL` is not set. This means you can immediately
     run the backend without installing MySQL. To use MySQL instead set
     `DB_PROVIDER=mysql` and provide a proper connection string.

   ```
   mysql://USER:PASSWORD@HOST:PORT/DATABASE
   ```

   If you don't provide a `DATABASE_URL` the server will start but login/register routes
   will not function (you'll see a warning message in the console).

2. From the `backend` directory run:

   ```bash
   npm install
   npm run db:setup
   ```

   The latter command runs `prisma migrate dev` (or falls back to `prisma db push`).
   The server also automatically pushes the schema and seeds a default user each time it
   starts.

3. When no users exist a default account `dev@example.com` / `Password123!` will be created.
   You can log in with that credential or hit `/api/register` to create your own.

4. Start the backend with `npm run dev` (for live reload) or `npm start`.

The frontend lives under the `frontend` directory and can be started with `npm install && npm start`.
