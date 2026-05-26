import { writeFileSync } from "fs";

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ICPLadda - LIS</title>
    <meta name="description" content="LIS - Lab Information System">
    <meta name="author" content="ICP Ladda" />
    <link rel="icon" type="image/png" href="/LIS/favicon.png">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const authHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Authenticating...</title>
  </head>
  <body>
    Completing sign-in...
  </body>
</html>
`;

writeFileSync("index.html", indexHtml, "utf8");
writeFileSync("auth.html", authHtml, "utf8");
console.log("✅ index.html and auth.html restored");
