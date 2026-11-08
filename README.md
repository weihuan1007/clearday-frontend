# ClearDay Frontend

Static frontend for the ClearDay reminder app.

## Files

- `index.html`: page markup
- `styles.css`: shared layout and design tokens
- `calendar.css`: month and hourly calendar views
- `components.css`: forms, dialogs, buttons, and reminder cards
- `responsive.css`: mobile and tablet layout rules
- `dates.js`: date formatting and calendar math helpers
- `storage.js`: browser localStorage fallback
- `auth.js`: Cognito authorization-code and PKCE sign-in session
- `session-view.js`: sign-in screen and signed-in account UI
- `api.js`: authenticated API calls
- `reminder-model.js`: reminder normalization, validation, and formatting
- `reminder-repository.js`: API and local persistence
- `reminder-form.js`: add/edit dialog behavior
- `calendar-view.js`: month, day, and events rendering
- `money-model.js`: MYR amounts, categories, totals, and Money Flow backup conversion
- `money-repository.js`: signed-in transaction API and localhost preview storage
- `money-page.js` and `money.css`: Money tab behavior and layout
- `app.js`: application state and navigation
- `config.example.js`: example runtime config

## Local Preview

Run the Go backend and open `http://localhost:8080`. The backend serves these frontend files locally.

With Cognito off on localhost, the Money tab saves preview data in that browser.
On the deployed site it uses the signed-in transaction API.

For production, the deployed `config.js` should contain:

```js
window.CLEARDAY_CONFIG = {
  apiBase: "/api",
  auth: {
    domain: "https://your-domain.auth.ap-southeast-1.amazoncognito.com",
    clientId: "your-cognito-client-id",
    redirectUri: "https://your-cloudfront-domain.cloudfront.net/",
    logoutUri: "https://your-cloudfront-domain.cloudfront.net/",
  },
};
```

These values identify a public browser client; they are not a password or client secret. The browser uses authorization-code flow with PKCE and sends a short-lived Cognito access token to the backend.

## Manual AWS Upload

Upload these files to the root of the S3 frontend bucket:

```text
index.html
auth.js
session-view.js
dates.js
storage.js
api.js
reminder-model.js
reminder-repository.js
reminder-form.js
calendar-view.js
app.js
styles.css
calendar.css
components.css
responsive.css
money-model.js
money-repository.js
money-page.js
money.css
config.js
```

Then invalidate CloudFront:

```text
/*
```

## GitHub Actions Later

When you are ready to use GitHub Actions, add repository variables:

```text
AWS_REGION
AWS_ROLE_TO_ASSUME
AWS_FRONTEND_BUCKET
CLOUDFRONT_DISTRIBUTION_ID
FRONTEND_API_BASE=/api
COGNITO_DOMAIN
COGNITO_CLIENT_ID
COGNITO_REDIRECT_URI
COGNITO_LOGOUT_URI
```
