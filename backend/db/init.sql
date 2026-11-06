CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  allow_cv_download BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id           SERIAL PRIMARY KEY,
  user_id      INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name    VARCHAR(150) NOT NULL,
  headline     VARCHAR(200),
  bio          TEXT,
  email        VARCHAR(255),
  phone        VARCHAR(30),
  city         VARCHAR(100),
  linkedin_url TEXT,
  github_url   TEXT,
  website_url  TEXT,
  photo_url    TEXT
);

CREATE TABLE IF NOT EXISTS experiences (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position    VARCHAR(150) NOT NULL,
  company     VARCHAR(150) NOT NULL,
  company_url TEXT,
  start_date  DATE,
  end_date    DATE,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS education (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  degree      VARCHAR(150) NOT NULL,
  school      VARCHAR(150) NOT NULL,
  start_date  DATE,
  end_date    DATE,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS skills (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  category   VARCHAR(50),
  level      SMALLINT CHECK (level BETWEEN 1 AND 5),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(150) NOT NULL,
  description  TEXT,
  technologies TEXT[],
  repo_url     TEXT,
  demo_url     TEXT,
  image_url    TEXT,
  sort_order   INT NOT NULL DEFAULT 0
);

-- Profil public de démonstration; les coordonnées restent vides.
-- Ce compte n'a pas de mot de passe utilisable pour se connecter.
INSERT INTO users (email, password_hash, slug, is_public, allow_cv_download)
VALUES ('demo@example.com', 'hash_a_remplacer', 'hamza-oubahim', TRUE, TRUE)
ON CONFLICT (email) DO UPDATE
SET slug = EXCLUDED.slug,
    is_public = EXCLUDED.is_public,
    allow_cv_download = EXCLUDED.allow_cv_download;

INSERT INTO profiles (user_id, full_name, headline, bio)
SELECT id,
       'Hamza Oubahim',
       'Full Stack Developer',
       'I work across the frontend and backend on web platforms, analytics features, and personal projects. I am currently building a video editor for short-form content.'
FROM users WHERE slug = 'hamza-oubahim'
ON CONFLICT (user_id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    headline = EXCLUDED.headline,
    bio = EXCLUDED.bio;

INSERT INTO experiences (user_id, position, company, company_url, start_date, end_date, description, sort_order)
SELECT id, 'Full Stack Developer', 'Mergefy', 'https://mergefy.io', DATE '2026-06-01', NULL,
       'I build and maintain features for the Mergefy web platform.', 0
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.user_id = u.id AND e.company = 'Mergefy' AND e.position = 'Full Stack Developer'
  );

INSERT INTO experiences (user_id, position, company, company_url, start_date, end_date, description, sort_order)
SELECT id,
       'Front-End Web Developer',
       'TBH-Montreal',
       'https://tbh.ma',
       DATE '2025-02-01',
       NULL,
       'I build frontend features for The Big Heart Association, add analytics and user-behavior tracking, and improve the experience with my team.',
       1
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM experiences e WHERE e.user_id = u.id AND e.company = 'TBH-Montreal'
  );

INSERT INTO experiences (user_id, position, company, company_url, start_date, end_date, description, sort_order)
SELECT id,
       'Software Developer',
       'Hospital Mohamed Bouafi, Casablanca',
       NULL,
       DATE '2022-09-01',
       DATE '2022-10-01',
       'I built a Python desktop app for patient records. I worked on the database, data entry, validation, and reports.',
       2
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM experiences e WHERE e.user_id = u.id AND e.company = 'Hospital Mohamed Bouafi, Casablanca'
  );

INSERT INTO education (user_id, degree, school, start_date, end_date, description, sort_order)
SELECT id, 'DEP in Full Stack Development', 'OFPPT Casablanca', DATE '2021-08-01', DATE '2023-08-01',
       'Application development with Python, SQL databases, data analysis, and system architecture.', 1
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM education e WHERE e.user_id = u.id AND e.degree = 'DEP in Full Stack Development' AND e.school = 'OFPPT Casablanca'
  );

INSERT INTO education (user_id, degree, school, start_date, end_date, description, sort_order)
SELECT id, 'AEC in Web Development', 'College Lasalle Montreal', DATE '2024-08-01', NULL,
       'Coursework in database management, object-oriented programming, computer architecture, data structures, and algorithms.', 0
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM education e
    WHERE e.user_id = u.id AND e.degree = 'AEC in Web Development' AND e.school = 'College Lasalle Montreal'
  );

INSERT INTO skills (user_id, name, category, sort_order)
SELECT u.id, skill.name, skill.category, skill.sort_order
FROM users u
CROSS JOIN (VALUES
  ('TypeScript', 'Language', 0),
  ('Python', 'Language', 1),
  ('JavaScript', 'Language', 2),
  ('PHP', 'Language', 3),
  ('C#', 'Language', 4),
  ('Node.js', 'Runtime', 5),
  ('React', 'Framework', 6),
  ('Laravel', 'Framework', 7),
  ('Vue.js', 'Framework', 8),
  ('NestJS', 'Framework', 9),
  ('PostgreSQL', 'Database', 10),
  ('MySQL', 'Database', 11),
  ('MongoDB', 'Database', 12),
  ('Oracle', 'Database', 13),
  ('TypeORM', 'Tool', 14),
  ('Redis', 'Tool', 15),
  ('FFmpeg', 'Tool', 16),
  ('Remotion', 'Framework', 17),
  ('Deepgram', 'Service', 18),
  ('English (fluent)', 'Languages', 19),
  ('French (fluent)', 'Languages', 20),
  ('Arabic (native)', 'Languages', 21)
) AS skill(name, category, sort_order)
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM skills s WHERE s.user_id = u.id AND s.name = skill.name
  );

INSERT INTO projects (user_id, title, description, technologies, demo_url, sort_order)
SELECT id,
       'Video Editor · Hamza',
       'I am building a video editor for talking-head recordings. It transcribes audio, adds captions and B-roll, creates clips, and exports them for social platforms.',
       ARRAY['NestJS', 'TypeScript', 'PostgreSQL', 'TypeORM', 'Redis', 'FFmpeg', 'Remotion', 'Deepgram'],
       'https://app.oubahim.com',
       0
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.user_id = u.id AND p.title = 'Video Editor · Hamza'
  );

INSERT INTO projects (user_id, title, description, technologies, demo_url, sort_order)
SELECT id,
       'Journey Assistant',
       'A travel app that suggests places based on a person’s preferences. It gets information from an API and stores travel data in a database.',
       ARRAY['React', 'Laravel'],
       NULL,
       1
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.user_id = u.id AND p.title = 'Journey Assistant'
  );

INSERT INTO projects (user_id, title, description, technologies, demo_url, sort_order)
SELECT id,
       'Ebook Platform',
       'I made a content management tool with user sign-in, an analytics dashboard, and a MySQL database.',
       ARRAY['PHP', 'MySQL'],
       'https://thuswespeak.com',
       2
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.user_id = u.id AND p.title = 'Ebook Platform'
  );

INSERT INTO projects (user_id, title, description, technologies, demo_url, sort_order)
SELECT id,
       'DEVIS PRO',
       'A business tool for setting prices, reviewing customer data, and generating reports.',
       NULL,
       NULL,
       3
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.user_id = u.id AND p.title = 'DEVIS PRO'
  );

INSERT INTO projects (user_id, title, description, technologies, demo_url, sort_order)
SELECT id,
       'Patient Data Management System',
       'A Python desktop app I made to manage patient records, enter data, and create reports.',
       ARRAY['Python', 'Tkinter', 'SQL'],
       NULL,
       4
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.user_id = u.id AND p.title = 'Patient Data Management System'
  );

INSERT INTO projects (user_id, title, description, technologies, demo_url, sort_order)
SELECT id,
       'Mergefy.io',
       'Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4; browser tracking SDK for Shopify and first-party events. Backend: NestJS 11, Node.js/TypeScript, TypeORM; PostgreSQL 17, Redis 7 with BullMQ; Firebase/JWT auth, Stripe billing, Sentry; Docker Compose.',
       ARRAY[
         'Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS 4', 'Shopify tracking SDK',
         'First-party events', 'NestJS 11', 'Node.js', 'TypeORM', 'PostgreSQL 17', 'Redis 7',
         'BullMQ', 'Firebase/JWT auth', 'Stripe billing', 'Sentry', 'Docker Compose'
       ],
       'https://mergefy.io',
       5
FROM users u
WHERE u.slug = 'hamza-oubahim'
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.user_id = u.id AND p.title = 'Mergefy.io'
  );
