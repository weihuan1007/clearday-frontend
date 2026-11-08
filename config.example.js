window.CLEARDAY_CONFIG = {
  // Use /api when CloudFront routes /api/* to the EC2 backend.
  // Use a full URL, such as "https://your-api.example.com/api", when the API is hosted separately.
  apiBase: "/api",

  auth: {
    domain: "https://your-domain.auth.ap-southeast-1.amazoncognito.com",
    clientId: "your-public-cognito-client-id",
    redirectUri: "https://your-cloudfront-domain.cloudfront.net/",
    logoutUri: "https://your-cloudfront-domain.cloudfront.net/",
  },
};
