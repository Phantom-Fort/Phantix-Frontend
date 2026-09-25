export interface IssueMeta {
  name: string;
  number: string;
  date: string;
  folio: string;
  kicker: string;
  deck: string;
  byline: string;
  pullQuote: string;
  pullCite: string;
  newsletterLabel: string;
  newsletterBlurb: string;
  newsletterUrl: string;
}

/** A post as returned by the list endpoint (no markdown body). */
export interface PostSummary {
  slug: string;
  title: string;
  no: string;
  order: number;
  date: string;
  kicker?: string;
  excerpt: string;
  featured?: boolean;
}

/** A full post with its raw markdown body. */
export interface Post extends PostSummary {
  body: string;
}

/** GET /posts — the admin backend's list shape. */
export interface PostsResponse {
  issue?: Partial<IssueMeta>;
  posts: PostSummary[];
}
