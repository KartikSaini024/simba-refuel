

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- express (local backend server for sending emails)

## Notes on Email Sending

### Testing Emails Locally

In `src/components/EmailReportSender.tsx`, there is a comment showing how to switch the API endpoint to your local Express server for testing email sending before deploying to Vercel.  

- By default, the frontend calls the serverless function at `/api/sendReportEmail`.
- To test with your local server (e.g., `http://localhost:5000/api/sendReportEmail`), uncomment or modify the fetch URL in `handleSendEmail` accordingly.
- Make sure your local server (`server.js`) is running and the environment variables (`GMAIL_USER` and `GMAIL_PASS`) are set in your `.env` file.
