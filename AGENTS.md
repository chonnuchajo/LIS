# Codex Instructions

## No-build policy

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or any equivalent production/dev build command unless the user explicitly asks for a build in the current conversation.
- Do not run scripts that indirectly trigger the build or `postbuild` workflow without explicit user approval.
- For normal validation, prefer `npx tsc --noEmit`, `npm run test`, `npm run lint`, and focused test commands.
- This repository's build flow rewrites root production files, including `app.html` and `assets/`, so an unsolicited build can disrupt the working tree and deployment state.

