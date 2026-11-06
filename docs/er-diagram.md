# Entity-relationship diagram

```mermaid
erDiagram
  USERS ||--|| PROFILES : has
  USERS ||--o{ EXPERIENCES : lists
  USERS ||--o{ EDUCATION : lists
  USERS ||--o{ SKILLS : lists
  USERS ||--o{ PROJECTS : lists

  USERS {
    int id PK
    string email UK
    string password_hash
    string slug UK
    boolean is_public
    boolean allow_cv_download
    timestamptz created_at
  }

  PROFILES {
    int id PK
    int user_id FK,UK
    string full_name
    string headline
    text bio
    string email
    string phone
    string city
    text linkedin_url
    text github_url
    text website_url
    text photo_url
  }

  EXPERIENCES {
    int id PK
    int user_id FK
    string position
    string company
    text company_url
    date start_date
    date end_date
    text description
    int sort_order
  }

  EDUCATION {
    int id PK
    int user_id FK
    string degree
    string school
    date start_date
    date end_date
    text description
    int sort_order
  }

  SKILLS {
    int id PK
    int user_id FK
    string name
    string category
    smallint level
    int sort_order
  }

  PROJECTS {
    int id PK
    int user_id FK
    string title
    text description
    array technologies
    text repo_url
    text demo_url
    text image_url
    int sort_order
  }
```

The `users` table stores sign-in and visibility fields. `profiles` stores public identity and contact content. The four list tables are user-owned records and are deleted automatically when their account is deleted. Skill `level`, when supplied, is limited to 1–5.
