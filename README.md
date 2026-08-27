# ClearDay Frontend

Static frontend for the ClearDay reminder app.

## Files

- `index.html`: page markup
- `styles.css`: visual design
- `dates.js`: date formatting and calendar math helpers
- `storage.js`: browser localStorage fallback
- `api.js`: API calls and API token prompt
- `app.js`: calendar and reminder UI logic
- `config.example.js`: example runtime config

## Local Preview

Run the Go backend and open `http://localhost:8080`. The backend serves these frontend files locally.

For production, the deployed `config.js` should contain:

```js
window.CLEARDAY_CONFIG = {
  apiBase: "/api",
};
```

## Manual AWS Upload

Upload these files to the root of the S3 frontend bucket:

```text
index.html
dates.js
storage.js
api.js
app.js
styles.css
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
```
