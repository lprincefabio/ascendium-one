// Ascendium Global Holdings — organisation definition from the public source
// of truth (ascendiumventures.org): one holding company, five clusters,
// nineteen enterprises.

export const ORG = {
  name: "Ascendium Global Holdings",
  legalName: "Ascendium Global Holdings (AGH)",
  tagline: "One holding company. Five clusters. 19 enterprises.",
  mission: "Financial stewardship as a calling. Building enduring businesses that solve global challenges.",
  vision:
    "We don't measure ourselves by what we own, but by what we leave behind — institutions worthy of the trust placed in them.",
  foundedYear: 2025,
};

export const CLUSTERS: { name: string; slug: string; description: string }[] = [
  {
    name: "Finance",
    slug: "finance",
    description:
      "Capital stewardship across consulting, legal, investment and sovereign wealth management.",
  },
  {
    name: "Knowledge",
    slug: "knowledge",
    description:
      "The learning and ideas cluster: media, academia, sport, schools, skills, governance, research and trust.",
  },
  {
    name: "Infrastructure",
    slug: "infrastructure",
    description: "Hard assets and logistics: transport, energy and oceanic logistics.",
  },
  {
    name: "Technology",
    slug: "technology",
    description: "Digital exchange platforms and cyber defence capability.",
  },
  {
    name: "Frontier",
    slug: "frontier",
    description: "Frontier science and engineering: aeromarine horizons and life sciences.",
  },
];

export type SubsidiaryDef = {
  name: string;
  slug: string;
  cluster: string;
  sector: string;
  description: string;
  ceoFirst: string;
  ceoLast: string;
  departments: string[];
};

export const SUBSIDIARIES: SubsidiaryDef[] = [
  // FINANCE
  {
    name: "Ascendium Consulting & Investments",
    slug: "ascendium-consulting-investments",
    cluster: "finance",
    sector: "Advisory & Investment",
    description:
      "Strategic consulting and investment advisory serving corporates, universities, banks and governments.",
    ceoFirst: "Amara",
    ceoLast: "Nsonde",
    departments: ["Strategy", "Client Advisory", "Research", "Operations"],
  },
  {
    name: "Ascendium Legal Group",
    slug: "ascendium-legal-group",
    cluster: "finance",
    sector: "Legal Services",
    description: "Corporate, regulatory and cross-border legal counsel for the ecosystem and external clients.",
    ceoFirst: "Thabo",
    ceoLast: "Mbeki-Smith",
    departments: ["Corporate Law", "Compliance", "Disputes"],
  },
  {
    name: "Ascendium Capital Partners",
    slug: "ascendium-capital-partners",
    cluster: "finance",
    sector: "Investment Management",
    description: "Principal investment and portfolio management across the group's capital allocation mandate.",
    ceoFirst: "Nadia",
    ceoLast: "Okonkwo",
    departments: ["Investments", "Risk", "Finance"],
  },
  {
    name: "Ascendium Sovereign Wealth Fund",
    slug: "ascendium-sovereign-wealth-fund",
    cluster: "finance",
    sector: "Sovereign Investment",
    description: "Long-horizon sovereign capital stewardship for intergenerational prosperity.",
    ceoFirst: "Kwame",
    ceoLast: "Adeyemi",
    departments: ["Portfolio Strategy", "Treasury", "Governance"],
  },
  // KNOWLEDGE
  {
    name: "Ascendium Digital Media & Publishing",
    slug: "ascendium-digital-media-publishing",
    cluster: "knowledge",
    sector: "Media & Publishing",
    description: "Digital publishing, evidence communication and media production for the knowledge cluster.",
    ceoFirst: "Lerato",
    ceoLast: "Dlamini",
    departments: ["Editorial", "Production", "Distribution"],
  },
  {
    name: "Ascendium Academia",
    slug: "ascendium-academia",
    cluster: "knowledge",
    sector: "Higher Education",
    description: "University-grade learning, research programmes and executive education.",
    ceoFirst: "Ingrid",
    ceoLast: "van Wyk",
    departments: ["Academic Affairs", "Research", "Student Success"],
  },
  {
    name: "Ascendium Sports & Fitness",
    slug: "ascendium-sports-fitness",
    cluster: "knowledge",
    sector: "Sport & Wellness",
    description: "Athletic development, fitness sciences and sporting institutions.",
    ceoFirst: "Sipho",
    ceoLast: "Ndlovu",
    departments: ["Athlete Development", "Facilities", "Sports Science"],
  },
  {
    name: "Ascendium Global Schools",
    slug: "ascendium-global-schools",
    cluster: "knowledge",
    sector: "K-12 Education",
    description: "A network of schools delivering future-ready primary and secondary education.",
    ceoFirst: "Grace",
    ceoLast: "Mwangi",
    departments: ["Curriculum", "School Operations", "Admissions"],
  },
  {
    name: "Ascendium Career & Skills Development",
    slug: "ascendium-career-skills-development",
    cluster: "knowledge",
    sector: "Vocational Training",
    description: "Career pathways, vocational skills and employability programmes at scale.",
    ceoFirst: "Daniel",
    ceoLast: "Kiptoo",
    departments: ["Programmes", "Partnerships", "Assessment"],
  },
  {
    name: "Ascendium Pan-African Governance Institute",
    slug: "ascendium-pan-african-governance-institute",
    cluster: "knowledge",
    sector: "Governance Education",
    description:
      "Governance education and institutional-strengthening programmes for public and private institutions.",
    ceoFirst: "Fatima",
    ceoLast: "Sow",
    departments: ["Programme Delivery", "Research", "Fellowships"],
  },
  {
    name: "Ascendium Think Tank",
    slug: "ascendium-think-tank",
    cluster: "knowledge",
    sector: "Policy Research",
    description: "Evidence-based policy research and institutional thought leadership.",
    ceoFirst: "Yusuf",
    ceoLast: "Bello",
    departments: ["Research", "Policy", "Publications"],
  },
  {
    name: "Eiwass Ascendium Trust",
    slug: "eiwass-ascendium-trust",
    cluster: "knowledge",
    sector: "Philanthropy & Trust",
    description: "Philanthropic stewardship and community-impact trust operations.",
    ceoFirst: "Naomi",
    ceoLast: "Wanjiru",
    departments: ["Grantmaking", "Community", "Stewardship"],
  },
  // INFRASTRUCTURE
  {
    name: "Ascendium Transport",
    slug: "ascendium-transport",
    cluster: "infrastructure",
    sector: "Transport & Mobility",
    description: "Transport infrastructure, fleets and mobility systems across regional corridors.",
    ceoFirst: "Victor",
    ceoLast: "Mensah",
    departments: ["Fleet Operations", "Infrastructure", "Safety"],
  },
  {
    name: "Ascendium Energy",
    slug: "ascendium-energy",
    cluster: "infrastructure",
    sector: "Energy",
    description:
      "Renewable and conventional energy generation, distribution and asset development.",
    ceoFirst: "Elna",
    ceoLast: "Strijdom",
    departments: ["Asset Development", "Grid Operations", "Commercial"],
  },
  {
    name: "Ascendium Oceanic Logistics",
    slug: "ascendium-oceanic-logistics",
    cluster: "infrastructure",
    sector: "Maritime Logistics",
    description: "Port, shipping and oceanic supply-chain logistics capability.",
    ceoFirst: "Omar",
    ceoLast: "Hassan",
    departments: ["Port Operations", "Shipping", "Supply Chain"],
  },
  // TECHNOLOGY
  {
    name: "Ascendium Digital Exchange",
    slug: "ascendium-digital-exchange",
    cluster: "technology",
    sector: "Digital Platforms",
    description: "Digital marketplace and exchange platforms connecting the ecosystem's markets.",
    ceoFirst: "Tariq",
    ceoLast: "Aziz",
    departments: ["Platform Engineering", "Product", "Market Operations"],
  },
  {
    name: "Ascendium Cyber Defence",
    slug: "ascendium-cyber-defence",
    cluster: "technology",
    sector: "Cybersecurity",
    description: "Defensive cyber operations, security engineering and resilience services.",
    ceoFirst: "Kea",
    ceoLast: "Modise",
    departments: ["Security Operations", "Engineering", "Threat Intelligence"],
  },
  // FRONTIER
  {
    name: "Ascendium Aeromarine Horizons",
    slug: "ascendium-aeromarine-horizons",
    cluster: "frontier",
    sector: "Advanced Engineering",
    description: "Aeromarine engineering: advanced aerial and maritime systems at the frontier.",
    ceoFirst: "Ilya",
    ceoLast: "Vorobev",
    departments: ["R&D", "Flight Systems", "Marine Systems"],
  },
  {
    name: "Ascendium LifeScience & BioTech",
    slug: "ascendium-lifescience-biotech",
    cluster: "frontier",
    sector: "Life Sciences",
    description: "Biotechnology research, life-science ventures and health innovation.",
    ceoFirst: "Zanele",
    ceoLast: "Nxumalo",
    departments: ["Research", "Clinical", "Ventures"],
  },
];

/** Executive assistants / functional chiefs at group level (demo identities). */
export const GROUP_EXECUTIVES: { first: string; last: string; title: string; roleCode: string }[] = [
  { first: "Leon", last: "Kayanda", title: "Founder & Group CEO", roleCode: "GROUP_CEO" },
  { first: "Priya", last: "Raghavan", title: "Group Chief Financial Officer", roleCode: "GROUP_CFO" },
  { first: "Marcus", last: "Whitfield", title: "Group Chief Operating Officer", roleCode: "GROUP_COO" },
  { first: "Adaeze", last: "Eze", title: "Group CIO / CTO", roleCode: "GROUP_CIO" },
  { first: "Hannah", last: "Lindqvist", title: "Group Chief Human Resources Officer", roleCode: "GROUP_CHRO" },
  { first: "Ruth", last: "Achebe", title: "Group General Counsel", roleCode: "GROUP_GENERAL_COUNSEL" },
  { first: "Tomás", last: "Herrera", title: "Group Risk Officer", roleCode: "GROUP_RISK_OFFICER" },
  { first: "Selin", last: "Yilmaz", title: "Group Compliance Officer", roleCode: "GROUP_COMPLIANCE_OFFICER" },
];

export const ADMIN_IDENTITY = {
  first: "Systema",
  last: "Administrator",
  email: "admin@ascendium.local",
  title: "System Administrator",
};
