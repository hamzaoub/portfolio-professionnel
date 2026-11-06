# Test and quality report

Run date: 2026-10-28.

## Environment and scope

The current application was copied to an isolated worktree to preserve existing edits. A separate Compose project was built from that snapshot with fresh PostgreSQL and Redis volumes, new local environment values, frontend port 56173, and API port 54000. The existing development stack remained available on ports 55173 and 53000. After checking the fixes, the changed files were applied to the original working copy.

## Automated checks

| Check                        | Result                  | Evidence                                                                                                                                                                             |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend TypeScript build     | Pass                    | npm run build                                                                                                                                                                        |
| Backend ESLint               | Pass                    | npm run lint                                                                                                                                                                         |
| Backend Prettier             | Pass                    | npm run format:check                                                                                                                                                                 |
| Backend unit tests           | Pass                    | Six cases: registration validation, bcrypt byte limit, both PDF templates/content selection, normalized filename.                                                                    |
| Backend API integration      | Pass                    | PORTFOLIO_API_URL=http://127.0.0.1:54000 npm test; account registration, session, profile/privacy, content changes, PDF permission, password update, logout/login, account deletion. |
| Frontend build               | Pass                    | npm run build                                                                                                                                                                        |
| Frontend ESLint and Prettier | Pass                    | npm run lint; npm run format:check                                                                                                                                                   |
| Frontend component tests     | Pass                    | Six cases across AuthPage, Dashboard, and CVBuilder.                                                                                                                                 |
| Fresh Compose build/start    | Pass                    | Four services started with docker compose up --build after .env setup; health endpoint reports PostgreSQL and Redis up.                                                              |
| All content resources        | Pass                    | Additional temporary-account API checks created, read, edited and deleted experience, education, skills and projects; another account received 404 when attempting owner updates.    |
| Cache and response time      | Pass                    | Public cache TTL 300 seconds. Updated project appeared after invalidation. Twenty cached requests: median 2.80 ms, p95 4.65 ms, below 300 ms locally.                                |
| PDF cache regression         | Pass                    | Default item inclusion and explicit empty inclusion produce separate cached PDFs. Repeated default request returns identical cached bytes. Both templates checked.                   |
| Private/public PDF rules     | Pass                    | Anonymous downloads denied when disabled or private; authenticated owner retains access.                                                                                             |
| PDF page limit               | Pass                    | Classic and Modern full sample exports each have two pages. Oversized temporary content returns 422.                                                                                 |
| Security configuration       | Pass in inspected scope | Bcrypt storage checked in PostgreSQL; Redis session keys present; Helmet and configured credentialed CORS headers observed. No password/session-secret fallback remains in Compose.  |

## Browser and visual checks

Public page, CV builder, and an actual authenticated dashboard were inspected at desktop (1440 × 900), mobile (390 × 844), and tablet (768 × 1024) widths. Measured document widths matched their viewports in the inspected states. A temporary profile confirmed public phone, repository URL, and skill level rendering. Profile save, content creation, moving experience up and persistence after reload, sign-in and sign-out were exercised in the browser.

The CV builder switched templates and removed/restored the Projects section in the live preview. A browser download produced CV_Hamza_Oubahim.pdf. Both pages of Classic and Modern exports were rendered and visually inspected for clipping and readability. The sample PDF in output/pdf is the Modern export.

Labels, headings, image alternative text, visible focus styles and keyboard use of the skip link were reviewed. This is a focused basic accessibility review, not a complete WCAG or screen-reader certification. Only the English interface was checked; bilingual support is optional.

The README's public portfolio and registration screenshots were refreshed after the UI changes. Temporary test accounts and data belonged to the disposable validation stack; existing user portfolio content was not changed.

## Fixes made during this review

- Display saved public phone, skill level and project repository URL.
- Give project screenshots descriptive alternative text.
- Separate default and empty CV item selections in the PDF cache key, with a regression check.
- Format the four frontend components with Prettier.
- Read Compose password and session secret only from environment values, and document environment setup.
- Add the backend unit coverage required by section 9 using existing functions.

## Delivery still pending

At the October 28 review, repository publication and presentation were pending. The November 6 submission now includes a repository at https://github.com/hamzaoub/portfolio-professionnel with submission commits and feature branches. The original development history stays in the original working folder; the submission history begins with the prepared snapshot. The 12-minute presentation script is ready; the class presentation remains to be delivered. Optional extensions are not mandatory.

## Submission check — 2026-11-06

The final source was copied to `Portfolio_Hamza_Oubahim` without modifying the working development project. The current Pages assignment was exported with Pages and its body text and tables were checked. Its section 12 contains the secret, TypeScript and library citation rules. The requirements matrix now follows this supplied version.

Both packages passed TypeScript builds, ESLint and Prettier. All seven backend tests passed against the running development API; all six frontend tests passed across three components. The host used Node.js 25.6.0, which produced dependency engine warnings; Node.js 24 LTS is recommended and used by the Dockerfiles.

A separate Compose project was built from the submission copy with fresh PostgreSQL/Redis volumes (frontend 57173, API 55000). All four services started and the API health response reported PostgreSQL and Redis up. Both packages passed their build, lint, format and test checks inside the Node.js 24 containers. The browser rendered the seeded public portfolio with all six projects. The sample Modern PDF was regenerated and has two pages. The public screenshot was refreshed from this installation.

Dependency review identified a high severity Zod advisory. The backend now uses Zod 4.6.7 and its content schema type was updated; the backend build, lint, format and seven tests passed again with that version inside Docker. The npm audit also reported moderate findings in the ESLint/TypeScript lint dependency chain (minimatch); these development-tool findings remain unresolved. This report does not claim a vulnerability-free dependency tree. Dockerfiles use npm ci to install the lockfile versions.
