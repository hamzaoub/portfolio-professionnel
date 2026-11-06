export type ApiErrorBody = {
  error: string;
};

export type AuthenticatedAccount = {
  id: number;
  email: string;
  slug: string;
};

export type SessionUser = {
  id: number;
  account_email: string;
  slug: string;
  is_public: boolean;
  allow_cv_download: boolean;
  full_name: string;
  headline: string | null;
};

export type DashboardProfile = SessionUser & {
  bio: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  website_url: string | null;
  photo_url: string | null;
};

export type Experience = {
  id: number;
  position: string;
  company: string;
  company_url: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number;
};

export type Education = {
  id: number;
  degree: string;
  school: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number;
};

export type Skill = {
  id: number;
  name: string;
  category: string | null;
  level: number | null;
  sort_order: number;
};

export type Project = {
  id: number;
  title: string;
  description: string | null;
  technologies: string[] | null;
  repo_url: string | null;
  demo_url: string | null;
  image_url: string | null;
  sort_order: number;
};

export type PortfolioData = {
  profile: Omit<
    DashboardProfile,
    "id" | "account_email" | "is_public" | "allow_cv_download"
  >;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
};
