# How to Deploy to Netlify

This project is configured for deployment to Netlify. Follow these steps to deploy your application:

### 1. Connect to GitHub

- Create a new repository on GitHub and push your code to it.

### 2. Connect to Netlify

- Log in to your Netlify account and select "Add new site" -> "Import an existing project".
- Connect to your GitHub account and select the repository you just created.

### 3. Configure Build Settings

- The build settings are already configured in the `netlify.toml` file. Netlify should automatically detect and apply these settings.
- **Base directory:** (leave blank)
- **Build command:** `npm run build`
- **Publish directory:** `client/dist`

### 4. Add Environment Variables

- In the Netlify UI, go to "Site settings" -> "Build & deploy" -> "Environment".
- Add the following environment variables:
  - `DATABASE_URL`: Your Neon database connection string.
  - `NODE_ENV`: `production`

### 5. Deploy

- Click the "Deploy site" button. Netlify will start the build and deployment process.

Your site will be live at the URL provided by Netlify once the deployment is complete.
