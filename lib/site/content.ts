/**
 * Every word on the public site, in one typed, Zod-validated tree.
 *
 * The page components read from here and never inline copy, so the site can be
 * re-voiced, translated, or driven from a CMS later without touching a single
 * animation. Validation runs at module load: a malformed edit fails the build
 * and the test suite rather than shipping an empty section.
 */
import { z } from 'zod';

/** Where the public site lives inside this app. */
export const SITE_PATH = '/site';

/** True for the site root and anything nested under it — used to gate the OS chrome. */
export function isSiteRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === SITE_PATH || pathname.startsWith(`${SITE_PATH}/`);
}

const LinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const SectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
});

export const SiteContentSchema = z.object({
  brand: z.object({
    name: z.string().min(1),
    wordmark: z.string().min(1),
    tagline: z.string().min(1),
    domain: z.string().min(1),
  }),
  nav: z.array(LinkSchema).min(3),
  hero: z.object({
    eyebrow: z.string().min(1),
    headline: z.array(z.string().min(1)).min(2),
    sub: z.string().min(1),
    primary: LinkSchema,
    secondary: LinkSchema,
    ticker: z.array(z.string().min(1)).min(6),
  }),
  manifesto: SectionSchema.extend({
    body: z.string().min(1),
    signature: z.string().min(1),
  }),
  system: SectionSchema.extend({
    lede: z.string().min(1),
    states: z
      .array(
        z.object({
          key: z.enum(['sphere', 'lattice', 'ring']),
          name: z.string().min(1),
          copy: z.string().min(1),
        }),
      )
      .length(3),
  }),
  pillars: z.array(
    z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      brief: z.string().min(1),
      agents: z.array(z.string().min(1)).min(2),
    }),
  ),
  pillarSection: SectionSchema,
  modules: z.array(
    z.object({
      title: z.string().min(1),
      route: z.string().startsWith('/'),
      blurb: z.string().min(1),
      detail: z.array(z.string().min(1)).min(2),
    }),
  ),
  moduleSection: SectionSchema,
  metrics: z.array(
    z.object({
      value: z.number(),
      prefix: z.string().default(''),
      suffix: z.string().default(''),
      label: z.string().min(1),
      note: z.string().min(1),
    }),
  ),
  process: SectionSchema.extend({
    steps: z
      .array(
        z.object({
          index: z.string().min(1),
          title: z.string().min(1),
          copy: z.string().min(1),
        }),
      )
      .min(3),
  }),
  cta: SectionSchema.extend({
    body: z.string().min(1),
    primary: LinkSchema,
    secondary: LinkSchema,
    reassurance: z.string().min(1),
  }),
  footer: z.object({
    blurb: z.string().min(1),
    columns: z.array(z.object({ title: z.string().min(1), links: z.array(LinkSchema).min(1) })).min(2),
    legal: z.string().min(1),
  }),
});

export type SiteContent = z.infer<typeof SiteContentSchema>;

const CONTENT = {
  brand: {
    name: 'Founder OS',
    wordmark: 'FOUNDER OS',
    tagline: 'One operator. A company that runs itself.',
    domain: 'thefounderos.com',
  },
  nav: [
    { label: 'Manifesto', href: '#manifesto' },
    { label: 'System', href: '#system' },
    { label: 'Pillars', href: '#pillars' },
    { label: 'Modules', href: '#modules' },
    { label: 'Process', href: '#process' },
  ],
  hero: {
    eyebrow: 'Personal operating system',
    headline: ['Run the whole', 'company from', 'one screen.'],
    sub: 'Founder OS turns the tabs, tools and mental overhead of a solo business into a single command deck — unified comms, a living client funnel, a knowledge core, and a roster of named AI agents that each own a real job.',
    primary: { label: 'Enter the console', href: '/' },
    secondary: { label: 'See the system', href: '#system' },
    ticker: [
      'Unified comms',
      'Client funnel',
      'Knowledge core',
      'Agent roster',
      'Growth telemetry',
      'Ledger',
      'Workflows',
      'Org hierarchy',
    ],
  },
  manifesto: {
    id: 'manifesto',
    eyebrow: 'The premise',
    title: 'Software should hold the company, not the founder',
    body: 'A one-person business fails in the gaps between tools. The lead that never got answered. The invoice that never got chased. The idea that lived in a note nobody opened again. Founder OS closes those gaps by giving every recurring job an owner — a named agent with a real runtime, wired to real accounts, reporting into one deck you actually look at. You stay the operator. The company keeps running when you close the laptop.',
    signature: 'The operating principle behind every screen that follows.',
  },
  system: {
    id: 'system',
    eyebrow: 'The architecture',
    title: 'A swarm that resolves into an org',
    lede: 'Scroll to watch the same workforce reorganize itself: a loose swarm of capabilities, a structured hierarchy, a standing orbit around the conductor. Same agents — three ways of seeing them.',
    states: [
      { key: 'sphere', name: 'Swarm', copy: 'Capabilities before structure — every job the business actually does, unassigned.' },
      { key: 'lattice', name: 'Hierarchy', copy: 'Each capability lands under a pillar with an owner, a schedule, and a definition of done.' },
      { key: 'ring', name: 'Orbit', copy: 'In steady state they circle the conductor, running on their own cadence and escalating only what needs you.' },
    ],
  },
  pillarSection: {
    id: 'pillars',
    eyebrow: 'The org',
    title: 'Five pillars, one conductor',
  },
  pillars: [
    {
      name: 'Sales',
      code: 'P-01',
      brief: 'Every inbound lead answered, qualified and moved — with the whole journey visible as one living flow.',
      agents: ['Lead Triage', 'Pipeline Keeper', 'Follow-up'],
    },
    {
      name: 'Marketing',
      code: 'P-02',
      brief: 'Content shipped on cadence across every channel, with growth measured where it actually compounds.',
      agents: ['Content Engine', 'Audience Analyst', 'Distribution'],
    },
    {
      name: 'Tech',
      code: 'P-03',
      brief: 'The system that runs the system: connectors, runtimes, and the honest status of every integration.',
      agents: ['Connector Watch', 'Runtime Ops'],
    },
    {
      name: 'Finance',
      code: 'P-04',
      brief: 'Money in, money out, and the runway number you should never have to compute by hand.',
      agents: ['Ledger', 'Statement Parser', 'Runway'],
    },
    {
      name: 'Comms',
      code: 'P-05',
      brief: 'One inbox for every channel — email, chat, DMs, dictation — triaged before you open it.',
      agents: ['Inbox Triage', 'Reply Drafter'],
    },
  ],
  moduleSection: {
    id: 'modules',
    eyebrow: 'The surfaces',
    title: 'Every screen is a working screen',
  },
  modules: [
    {
      title: 'Comms',
      route: '/comms',
      blurb: 'Every channel collapsed into one triaged feed.',
      detail: ['Email, chat, DMs and dictation in one lane', 'Sorted by what actually needs you'],
    },
    {
      title: 'Funnel',
      route: '/funnel',
      blurb: 'The client journey as a living flow, not a spreadsheet.',
      detail: ['One node per client, stage by stage', 'Decay makes neglect visible'],
    },
    {
      title: 'G-Brain',
      route: '/brain',
      blurb: 'A knowledge core that remembers what you already decided.',
      detail: ['Markdown store with hybrid search', 'Graph view over everything you know'],
    },
    {
      title: 'Agents',
      route: '/agents',
      blurb: 'A roster of named workers, each with a real run().',
      detail: ['Every agent maps to a real runtime', 'Last-run state, never a mock'],
    },
    {
      title: 'Social',
      route: '/social',
      blurb: 'Growth telemetry per account, per platform.',
      detail: ['Follower curves and audience share', 'Posting cadence you can hold'],
    },
    {
      title: 'Finances',
      route: '/finances',
      blurb: 'Income, expenses and runway, kept current.',
      detail: ['Statements parsed into a ledger', 'Money-out by category'],
    },
  ],
  metrics: [
    { value: 1, prefix: '', suffix: '', label: 'Operator', note: 'You, holding the whole thing' },
    { value: 12, prefix: '', suffix: '', label: 'Named agents', note: 'Each with a real job and a runtime' },
    { value: 5, prefix: '', suffix: '', label: 'Pillars', note: 'Sales, Marketing, Tech, Finance, Comms' },
    { value: 0, prefix: '', suffix: '', label: 'Tabs to keep open', note: 'One deck, one keystroke away' },
  ],
  process: {
    id: 'process',
    eyebrow: 'The build',
    title: 'How a company gets installed',
    steps: [
      { index: '01', title: 'Map the work', copy: 'Every recurring job in the business gets written down once — the ones you do, the ones you avoid, and the ones falling through.' },
      { index: '02', title: 'Give each job an owner', copy: 'Jobs become named agents under a pillar, with a schedule, an input, and a definition of done you can check.' },
      { index: '03', title: 'Wire the real accounts', copy: 'Connectors report honest status. Nothing shows "connected" until it genuinely is — a dashboard that lies is worse than no dashboard.' },
      { index: '04', title: 'Run it in public', copy: 'One deck, open on the second monitor. The company keeps moving whether or not you are looking at it.' },
    ],
  },
  cta: {
    id: 'start',
    eyebrow: 'Next',
    title: 'Install the operating system',
    body: 'The full build is open source and seeded with realistic data, so every screen is alive the moment it boots. Walk the console yourself, or build your own with guidance.',
    primary: { label: 'Open the console', href: '/' },
    secondary: { label: 'Join the cohort', href: 'https://www.thefounderos.com' },
    reassurance: 'No accounts, no API keys, nothing to configure to look around.',
  },
  footer: {
    blurb: 'A personal operating system for a one-person business.',
    columns: [
      {
        title: 'System',
        links: [
          { label: 'Console', href: '/' },
          { label: 'Agents', href: '/agents' },
          { label: 'G-Brain', href: '/brain' },
          { label: 'Connections', href: '/integrations' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'Manifesto', href: '#manifesto' },
          { label: 'Cohort', href: 'https://www.thefounderos.com' },
        ],
      },
    ],
    legal: 'Built as an open demo build. Every number on the console is seeded, honest, and labeled as such.',
  },
} as const;

export const SITE: SiteContent = SiteContentSchema.parse(CONTENT);

/** Anchor ids of every section the page renders, in document order. */
export function sectionIds(): string[] {
  return [
    'hero',
    SITE.manifesto.id,
    SITE.system.id,
    SITE.pillarSection.id,
    SITE.moduleSection.id,
    'proof',
    SITE.process.id,
    SITE.cta.id,
  ];
}
