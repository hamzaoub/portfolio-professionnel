# REST API reference

Base URL: `http://localhost:3000`. JSON requests use `Content-Type: application/json`. The frontend sends requests with credentials enabled. Successful registration/login sets the HTTP-only `portfolio.sid` session cookie; protected routes return `401` without a valid session. Validation errors return `400`; resource IDs owned by another account are reported as not found.

## Health

| Method | Route         | Description                                    |
| ------ | ------------- | ---------------------------------------------- |
| `GET`  | `/api/health` | Check API, PostgreSQL, and Redis connectivity. |

## Authentication and account

| Method   | Route                | Request body                             | Result                                                                                           |
| -------- | -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST`   | `/api/auth/register` | `{ "email", "password", "full_name" }`   | Creates a private account and signs it in. Password: 8–72 characters and at most 72 UTF-8 bytes. |
| `POST`   | `/api/auth/login`    | `{ "email", "password" }`                | Starts a Redis-backed session. Invalid credentials return the same message.                      |
| `GET`    | `/api/auth/me`       | —                                        | Returns the current user or `401`.                                                               |
| `POST`   | `/api/auth/logout`   | —                                        | Destroys the current session and clears the cookie.                                              |
| `PUT`    | `/api/auth/password` | `{ "current_password", "new_password" }` | Verifies the current password and changes the password hash.                                     |
| `DELETE` | `/api/auth/account`  | —                                        | Deletes the account and cascaded portfolio records, then ends the current session.               |

Registration is limited to 8 attempts per IP per hour; login is limited to 12 attempts per IP per 15 minutes. Limits are stored in Redis.

## Profile

| Method | Route          | Description                                 |
| ------ | -------------- | ------------------------------------------- |
| `GET`  | `/api/profile` | Returns the signed-in user's profile.       |
| `PUT`  | `/api/profile` | Updates one or more allowed profile fields. |

Update fields may include `full_name`, `headline`, `bio`, `email`, `phone`, `city`, `linkedin_url`, `github_url`, `website_url`, `photo_url`, `slug`, `is_public`, and `allow_cv_download`. URLs must use HTTP or HTTPS. Empty optional contact fields should be sent as `null`. Changing a slug updates the user's public URL; duplicate slugs return `409`.

## Portfolio content

All routes require authentication and operate only on records owned by the current user. `GET` returns `{ "items": [...] }`; `POST` returns `201` and `{ "item": ... }`; `PUT` returns `{ "item": ... }`; `DELETE` returns `204`.

| Collection         | Fields                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `/api/experiences` | `position`, `company`, `company_url`, `start_date`, `end_date`, `description`, `sort_order`              |
| `/api/education`   | `degree`, `school`, `start_date`, `end_date`, `description`, `sort_order`                                |
| `/api/skills`      | `name`, `category`, `level` (1–5), `sort_order`                                                          |
| `/api/projects`    | `title`, `description`, `technologies` (string array), `repo_url`, `demo_url`, `image_url`, `sort_order` |

For each collection, use `GET` or `POST` on the collection path and `PUT /:id` or `DELETE /:id` on a record. List order is controlled by `sort_order` and can be changed through edits.

## Public portfolio

| Method | Route               | Description                                                                                                                    |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/public/:slug` | Returns `{ profile, experiences, education, skills, projects }` for a public profile. A private or missing slug returns `404`. |

Public responses are cached in Redis for five minutes and invalidated when the owner changes their profile, slug, or content.

## CV preview and download

| Method | Route              | Description                                           |
| ------ | ------------------ | ----------------------------------------------------- |
| `GET`  | `/api/cv/preview`  | Returns an inline PDF.                                |
| `GET`  | `/api/cv/download` | Returns an attachment PDF named `CV_<Full_Name>.pdf`. |

Both routes accept query parameters:

| Parameter  | Values                                                                      | Behavior                                                                                           |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `slug`     | Readable profile slug                                                       | Defaults to `hamza-oubahim`.                                                                       |
| `template` | `modern` or `classic`                                                       | Defaults to `modern`.                                                                              |
| `sections` | Comma-separated `profile`, `experiences`, `education`, `skills`, `projects` | Defaults to all sections.                                                                          |
| `include`  | Comma-separated `<section>:<id>` entries                                    | If omitted, includes all entries from selected sections. If present, includes only listed entries. |

Public visitors can generate a CV only when both public visibility and CV downloads are enabled. An authenticated owner can preview/download a CV for their own slug even when the public portfolio is private. PDFs are cached in Redis for 30 minutes with a key based on user, template, selected content, and a hash of the current data. If the selected content would exceed two pages, the API returns 422 and asks for fewer sections or items.
