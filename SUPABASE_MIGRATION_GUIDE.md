# Supabase Project Migration Guide

This guide outlines the steps to transfer your application's backend to a new Supabase project (e.g., upgrading to a paid tier or moving accounts) while preserving your database structure and logic.

## Prerequisites

- Access to both the **Old** and **New** Supabase accounts.
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm install -g supabase`).
- Docker installed and running (required for some CLI commands).

---

## Step 1: Export Current Database Structure

You need to extract the SQL schema (tables, types, policies, triggers) from your current project.

### Option A: Using the CLI (Recommended)
1.  Link your local environment to your **OLD** project:
    ```bash
    npx supabase login
    npx supabase link --project-ref <OLD_PROJECT_REF>
    ```
    *(You can find the Project Reference ID in your Dashboard URL: `supabase.com/dashboard/project/<PROJECT_REF>`).*

2.  Dump the schema to a file:
    ```bash
    npx supabase db dump -f latest_schema.sql
    ```

3.  (Optional) If you have data (rows) you want to keep:
    ```bash
    npx supabase db dump --data-only -f data_dump.sql
    ```

### Option B: Using Existing Backup
If you have a `full_schema.sql` file in your project root, verify it is up-to-date with your latest changes.

---

## Step 2: Create the New Project

1.  Log in to your **NEW** Supabase account.
2.  Create a **New Project**.
3.  **Region**: Select the region closest to your users (e.g., `ap-southeast-2` for Sydney/Australia).
4.  **Database Password**: Set a strong password and **save it securely**. You will need this for the CLI and connecting directly.

---

## Step 3: Import Database Structure

1.  Go to the **SQL Editor** in your **NEW** Supabase Project Dashboard.
2.  Open your `latest_schema.sql` (or `full_schema.sql`) file in a text editor.
3.  Copy the entire content.
4.  Paste it into the SQL Editor on the dashboard and click **Run**.
    *   *Note: If the file is very large, consider running it in chunks or using the CLI to push migrations.*

---

## Step 4: Migrate Edge Functions & Config

Your local specific configurations and serverless functions need to be deployed to the new instance.

1.  **Login to the new account via CLI**:
    ```bash
    npx supabase login
    # Follow browser prompt to log in with the NEW account credentials
    ```

2.  **Link to the NEW Project**:
    ```bash
    npx supabase link --project-ref <NEW_PROJECT_REF>
    # Enter your NEW database password when prompted
    ```

3.  **Deploy Edge Functions**:
    ```bash
    npx supabase functions deploy
    ```

4.  **Upload Secrets**:
    If your functions use environment variables (secrets), set them in the new project:
    ```bash
    npx supabase secrets set VAR_NAME=value
    ```

---

## Step 5: Update Application Connection

Now point your frontend application to the new backend.

1.  Go to your **New Project Settings** -> **API**.
2.  Copy the **Project URL** and **anon public key**.
3.  Update your existing `.env` file (or build configuration):

    ```env
    VITE_SUPABASE_PROJECT_ID="<NEW_PROJECT_REF>"
    VITE_SUPABASE_URL="https://<NEW_PROJECT_REF>.supabase.co"
    VITE_SUPABASE_PUBLISHABLE_KEY="<NEW_ANON_KEY>"
    ```

---

## Step 6: Data Migration (If needed)

If you exported data in Step 1, now is the time to import it.

**Using CLI:**
You can use standard PostgreSQL tools like `psql` to restore data. You can find the connection string in **Settings** -> **Database**.

```bash
# General syntax
psql "postgresql://postgres:[NEW_DB_PASSWORD]@db.[NEW_PROJECT_REF].supabase.co:5432/postgres" -f data_dump.sql
```

---

## Final Verification

1.  Restart your local development server (`npm run dev`).
2.  Test critical flows (Login, Sign up, Data fetching) to ensure everything is connected to the new database.
3.  Check the **Logs** in the Supabase Dashboard to ensure Edge Functions are firing correctly.
