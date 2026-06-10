export type LegalSection = {
  title: string;
  body: string;
};

export type LegalContent = {
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  updated: string;
  footerNote: string;
  sections: LegalSection[];
};

export const termsContent: LegalContent = {
  eyebrow: "Terms of use",
  title: "Clear rules for using",
  accent: "Buck.",
  lede:
    "These terms describe the practical rules for using Buck Budget Tracker. They are written plainly so users know what the app does, what it does not do, and how accounts should be handled.",
  updated: "Last updated: June 2026",
  footerNote: "Personal budgeting support. Not financial advice.",
  sections: [
    {
      title: "Use Buck for personal budgeting",
      body:
        "Buck is built to help you track wallets, expenses, savings goals, and budget patterns. The app is not a bank, lender, broker, or financial adviser, and its suggestions should be treated as helpful planning information.",
    },
    {
      title: "Keep your account secure",
      body:
        "You are responsible for the email address, password, and sign-in methods connected to your account. Tell us if you believe your account has been accessed without permission.",
    },
    {
      title: "Enter accurate budget data",
      body:
        "Your dashboard depends on the wallet, expense, and goal details you provide. Buck can organize and summarize that information, but you should review the numbers before making money decisions.",
    },
    {
      title: "Use the service respectfully",
      body:
        "Do not misuse Buck, attempt to access another person's data, disrupt the service, or upload content that breaks the law. We may limit access when needed to protect users and the app.",
    },
    {
      title: "Service changes",
      body:
        "Buck may change features, improve workflows, or pause parts of the app for maintenance. When possible, we keep core account and budget access stable while improvements are made.",
    },
    {
      title: "Questions",
      body:
        "If you have questions about these terms, contact the Buck team from the support link provided in the app.",
    },
  ],
};

export const privacyContent: LegalContent = {
  eyebrow: "Privacy",
  title: "Your budget data should stay",
  accent: "yours.",
  lede:
    "This privacy page explains the main data Buck needs to run user accounts and budget features. It is meant to be easy to scan before creating an account.",
  updated: "Last updated: June 2026",
  footerNote: "Private planning for wallets, expenses, and goals.",
  sections: [
    {
      title: "Information you provide",
      body:
        "Buck uses your account email, optional username, wallet details, expenses, goals, and related budget records so the app can show your personal dashboard and keep your data synced.",
    },
    {
      title: "How Buck uses data",
      body:
        "Your information is used to sign you in, protect your session, display budget activity, calculate summaries, and provide relevant budgeting guidance inside the app.",
    },
    {
      title: "Authentication and hosting",
      body:
        "Supabase handles authentication and database storage for Buck. Vercel may host the web application. These providers process data only as needed to run the service.",
    },
    {
      title: "Budget privacy",
      body:
        "Buck does not sell your email or personal budget records. Budget data should only be available to your account when database row-level security policies are enabled correctly.",
    },
    {
      title: "Emails",
      body:
        "Buck may send account emails such as confirmation, password reset, magic link, email change, and security notifications. These emails help protect access to your account.",
    },
    {
      title: "Control and deletion",
      body:
        "You can request help with account access, corrections, or deletion through support. Some records may need to be retained for security, abuse prevention, or legal reasons.",
    },
  ],
};

export const legalContentByType = {
  terms: termsContent,
  privacy: privacyContent,
} as const;

export type LegalModalType = keyof typeof legalContentByType;
