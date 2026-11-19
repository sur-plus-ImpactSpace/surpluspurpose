/**
 * Key-based i18n (B7), German and English.
 *
 * Invariant: i18n covers **UI chrome only**. Demo and user-generated content
 * (company names, listings, needs, chat messages) is never translated.
 *
 * `Dictionary` is derived from the English entry, so the German one fails
 * typecheck the moment a key is missing or renamed. There is no runtime
 * fallback on purpose — a missing key should break the build, not the page.
 */

export type Locale = "en" | "de";

export const LOCALES: Locale[] = ["en", "de"];

/**
 * Cookie that persists the chosen UI language across navigation. The `?lang=`
 * query param stays the source of truth when present (deep-linkable), but most
 * in-app links (sidebar nav, mobile chips) drop it — so without this cookie the
 * server would fall back to the default locale on every click. The language
 * switcher writes it; the server pages read it when no `?lang=` is present.
 */
export const LOCALE_COOKIE = "surplus_lang";

export function resolveLocale(raw: string | string[] | undefined): Locale {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === "de" ? "de" : "en";
}

/**
 * Locale for a server-rendered page: the `?lang=` query param wins when set,
 * otherwise the persisted cookie, otherwise the default (`en`). Keeps the chosen
 * language stable when following in-app links that don't carry `?lang=`.
 */
export function resolveLocaleFrom(
  rawParam: string | string[] | undefined,
  cookieValue: string | undefined
): Locale {
  const param = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (param === "de" || param === "en") return param;

  return cookieValue === "de" ? "de" : "en";
}

const en = {
  platformTag: "Platform · Demo",
  workspaceTag: "Workspace",
  workspacePreviewWarning:
    "Supabase is configured but unavailable, so this request uses preview data:",
  aria: {
    language: "Language",
    perspective: "Workspace perspective",
    workspaceNav: "Workspace navigation",
    sections: "Workspace sections"
  },
  nav: {
    navigate: "Navigate",
    resources: "sur.plus",
    groupWork: "Work",
    groupEvidence: "Evidence & impact",
    groupAccount: "Organisation",
    overview: "Overview",
    workspace: "Workspace",
    matches: "Matches",
    inbox: "Inbox",
    listings: "Listings",
    cases: "Cases",
    needs: "Needs",
    evidenceImpact: "Evidence & impact",
    impact: "Impact",
    account: "Account",
    needsEvidence: "Needs & evidence",
    starterPackage: "Starter package",
    members: "Members",
    plans: "Plans",
    verification: "Verification",
    ngos: "NGOs",
    companies: "Companies",
    requests: "Requests",
    admins: "Admins",
    approvals: "Approvals",
    controls: "Controls",
    bookSession: "Book a session",
    landingPage: "Landing page"
  },
  shell: {
    sandbox: "Sandbox · resets",
    imprint: "Imprint",
    privacy: "Privacy"
  },
  tiers: {
    corporate: "Seed workspace",
    ngo: "NGO · always free",
    admin: "Internal console",
    editor: "Ops editor"
  },
  demoStart: {
    eyebrow: "Live demo",
    title: "Try sur.plus with sample data",
    lead: "You get your own private sandbox with made-up companies, NGOs and matches. Click through the whole loop; nothing you do is seen by anyone else or touches real data.",
    pick: "Start as",
    corporate: "A company with surplus",
    ngo: "A non-profit in need",
    admin: "sur.plus Ops",
    start: "Start my demo",
    note: "Your sandbox is deleted automatically after two hours without activity.",
    expired: "Your demo sandbox expired. Start a new one."
  },
  requestAccess: {
    eyebrow: "No invitation yet?",
    title: "Request access",
    lead: "Tell us who you are and we will get back to you personally. Nothing is shared with other organisations.",
    link: "Request access",
    nameLabel: "Your name",
    organizationLabel: "Organisation",
    roleLabel: "We are a…",
    roleCorporate: "Company with surplus",
    roleNgo: "Non-profit in need",
    emailLabel: "Work email",
    phoneLabel: "Phone (optional)",
    messageLabel: "What would you like to achieve? (optional)",
    consentBefore: "I have read the",
    consentLink: "privacy policy",
    consentAfter: "and agree that sur.plus contacts me about my request.",
    submit: "Send request",
    sending: "Sending…",
    doneTitle: "Thank you — we have your request",
    doneBody: "We will reach out to the address you gave us. Already invited? Sign in with the invitation link instead.",
    backToLogin: "Back to sign in",
    errors: {
      invalid_name: "Please enter your name.",
      invalid_organization: "Please enter your organisation.",
      invalid_role: "Please choose what describes you.",
      invalid_email: "Please enter a valid email address.",
      invalid_phone: "That phone number is too long.",
      invalid_message: "Your message is too long.",
      consent_required: "Please confirm the privacy policy to continue.",
      rate_limit_exceeded: "Too many attempts. Please try again in a few minutes.",
      generic: "We could not send your request. Please try again."
    }
  },
  auth: {
    tag: "Sign in",
    eyebrow: "Impact Space",
    title: "Sign in",
    subtitle:
      "Access for Corporate and NGO workspaces. Sign in with your e-mail and password.",
    inviteNotice:
      "You are accepting an invitation. Sign in with the invited email address to continue.",
    demoCta: "View the live demo",
    accessLead: "Prefer a guided start?",
    accessCta: "Book a 30-min session",
    register: {
      orgNameMissing: "Please enter your organisation's name.",
      salutationLabel: "Salutation",
      salutationPlaceholder: "Salutation",
      salutationHerr: "Mr.",
      salutationFrau: "Ms.",
      salutationDivers: "Mx.",
      salutationMissing: "Please select a salutation.",
      academicTitleLabel: "Academic title",
      academicTitleNone: "No title",
      firstNamePlaceholder: "First name — e.g. Maria",
      lastNamePlaceholder: "Last name — e.g. Muster",
      firstNameMissing: "Please enter your first name.",
      lastNameMissing: "Please enter your last name.",
      orgTypeLabel: "Type of organization",
      orgTypePlaceholder: "Type of organization",
      orgTypeVerein: "Non-profit association (e.V.)",
      orgTypeGgmbh: "Non-profit company (gGmbH/gUG)",
      orgTypeStiftung: "Non-profit foundation",
      orgTypePublicBody: "Public body (school, Kita, municipality)",
      orgTypeFreierTraeger: "Institution under independent/church sponsorship",
      orgTypeMissing: "Please select the type of your organization.",
      corporateFreemail:
        "Please register with your company e-mail address — free-mail addresses (Gmail, GMX, web.de, Outlook …) are not accepted for companies.",
      rolePlaceholder: "Your role (optional) — e.g. Facility Manager",
      phonePlaceholder: "Phone (optional)",
      confirmEyebrow: "One e-mail away",
      confirmTitle: "Confirm your e-mail address",
      confirmBodyBefore: "We sent a confirmation link to",
      confirmBodyAfter: "Click it and your workspace setup continues right where you left off.",
      confirmHint: "Nothing in your inbox? Check spam, or wait a minute — the link comes from service@surpluspurpose.com.",
      confirmBack: "Back to sign in",
      orgNamePlaceholderNgo: "Organisation name — e.g. Hilfe e.V.",
      orgNamePlaceholderCorporate: "Company name — e.g. Beispiel GmbH",
      chooseTitle: "First — who are you?",
      chooseLead: "Your path differs by organisation type. Pick one to continue.",
      ngo: "I'm an NGO",
      ngoHint: "Free forever. We verify your organisation, then your workspace opens.",
      corporate: "I'm a company",
      corporateHint: "List surplus and get audit-ready impact documentation. We set up your workspace.",
      change: "Change",
      continueNgo: "Create NGO account",
      continueCorporate: "Create company account",
      consentLead: "Before you continue, please confirm:",
      consentBefore: "I accept the",
      consentPrivacyLink: "Privacy Policy",
      consentTermsCorporate: "Terms of Service",
      consentTermsNgo: "Partner Agreement",
      consentRequired: "Please confirm both to create your account."
    },
    password: {
      heading: "Your password needs:",
      aria: "Password requirements",
      length: "at least 8 characters",
      upper: "an uppercase letter (A–Z)",
      lower: "a lowercase letter (a–z)",
      digit: "a number (0–9)",
      symbol: "a symbol (! ? # € …)",
      incomplete: "Your password does not meet all requirements yet — see the list below."
    },
    panel: {
      unavailable: "Sign-in is available on the deployed app.",
      emailPlaceholder: "name@company.org",
      passwordPlaceholder: "Password",
      newPasswordPlaceholder: "New password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      signIn: "Sign in",
      createAccount: "Create account",
      working: "Working…",
      sending: "Sending…",
      magicLink: "Email me a sign-in link instead",
      forgotPassword: "Forgot your password?",
      toSignup: "New here? Create an account",
      toSignin: "Already have an account? Sign in",
      googleRedirecting: "Redirecting…",
      googleContinue: "Continue with Google",
      or: "or",
      recoveryTitle: "Set a new password",
      recoveryLead:
        "You opened a password-reset link. Choose a new password to finish — you'll be signed in right after.",
      recoverySaving: "Saving…",
      recoverySet: "Set new password",
      mfaTitle: "Two-factor authentication",
      mfaLead: "Enter the 6-digit code from your authenticator app.",
      mfaVerifying: "Verifying…",
      mfaVerify: "Verify",
      enterEmailPassword: "Enter your email and password.",
      enterEmail: "Enter your email first.",
      enterPassword: "Enter your password.",
      enterEmailReset: "Enter your email first, then request the reset link.",
      magicLinkSent: "Check your email for the sign-in link.",
      resetSent: "If an account exists, a password-reset link is on its way.",
      passwordUpdated: "Password updated — signing you in…",
      googleFailed: "Google sign-in failed:",
      signUpFailed: "Sign-up failed:",
      signInFailed: "Sign-in failed:",
      mfaFailed: "2FA failed:",
      invalidCode: "Invalid code:",
      setPasswordFailed: "Could not set password:",
      resetFailed: "Reset failed:",
      recoveryChecking: "Checking your reset link…",
      recoveryInvalid:
        "This reset link is invalid or has expired. Request a new one from the sign-in page.",
      recoveryBackToLogin: "Back to sign-in",
      confirmPasswordPlaceholder: "Repeat new password",
      passwordsDontMatch: "The two passwords don't match yet.",
      captchaRequired: "Please complete the bot check first.",
      emailNotConfirmed: "Please confirm your e-mail address first — check your inbox, or resend the link below.",
      resendConfirmation: "Resend confirmation e-mail",
      confirmationResent: "Confirmation e-mail sent — check your inbox.",
      errInvalidCredentials: "Wrong e-mail or password.",
      errRateLimited: "Too many attempts — please wait a moment and try again.",
      errUserExists: "An account with this e-mail already exists — try signing in.",
      errWeakPassword: "That password is too weak — it must meet all the requirements below.",
      errInvalidEmail: "Please enter a valid e-mail address.",
      errSamePassword: "Choose a password different from your current one.",
      errGeneric: "Something went wrong. Please try again."
    },
    registered: {
      eyebrow: "Registration",
      titleConfirmed: "You're registered",
      leadConfirmed: "Your account is set up. Continue — we'll take you into the app.",
      titlePending: "Registration received",
      leadPending:
        "Almost there — confirm the link in the e-mail we just sent. Didn't get it? Sign in and we'll offer to resend it.",
      continueCta: "Continue",
      toSignin: "Go to sign-in",
      checking: "Finishing your registration…"
    },
    ticker: {
      eyebrow: "Since you opened this page",
      caption: "of usable goods destroyed or wasted worldwide — the gap sur.plus closes."
    },
    provisioning: {
      eyebrow: "Account access",
      title: "One step left",
      lead: "Your login is valid. Connect this account to a workspace and you are in — either below, or by accepting an invitation you received.",
      supportRef: "Support reference",
      emailLabel: "Email:",
      userIdLabel: "Auth user id:",
      notAvailable: "Not available"
    },
    adminMfa: {
      eyebrow: "Ops security",
      title: "Two-factor authentication is required",
      lead: "Admin accounts need a second factor. Set up an authenticator app below."
    },
    roleRequired: {
      eyebrow: "Access boundary",
      title: "sur.plus Ops access required",
      body: (required: string, active: string) =>
        `This workspace is limited to ${required} users. Your current session resolves as ${active}. The URL does not grant additional permissions.`,
      switcherAria: "Preview role",
      bootstrap: "Bootstrap Ops",
      roles: {
        corporate: { label: "Corporate", detail: "Listings and evidence" },
        ngo: { label: "NGO", detail: "Needs and incoming goods" },
        admin: { label: "sur.plus Ops", detail: "Internal role after auth" }
      }
    },
    claim: {
      ngoEyebrow: "NGO workspace",
      corporateEyebrow: "Company workspace",
      ngoLead:
        "Confirm your organisation's name and attach your eligibility proof — then your workspace opens. Ops reviews the proof; matching unlocks once you are verified.",
      corporateLead:
        "Confirm your company's name and your workspace opens: browse anonymised needs from verified NGOs. Who they are, contact and matching unlock with a plan.",
      orgNameAria: "Organisation name",
      ngoPlaceholder: "Organisation name — e.g. Hilfe e.V.",
      corporatePlaceholder: "Company name — e.g. Beispiel GmbH",
      proofLabel: "Eligibility proof (required)",
      proofHint: "PDF or image — e.g. your Freistellungsbescheid, or proof of public-law status.",
      proofChoose: "Choose file",
      proofRequired: "Please attach your eligibility proof to continue.",
      proofUploadFailed:
        "Your workspace opened, but the proof upload failed — you can upload it from your dashboard.",
      settingUp: "Setting up…",
      openWorkspace: "Open my workspace",
      errorNetwork: "Network error — please try again.",
      errorInvalidName: "Please enter your organisation's full name (at least 2 characters).",
      errorNoRole:
        "This account has no organisation type on record — please contact service@surpluspurpose.com.",
      errorNotAuthenticated: "Your session expired — please sign in again.",
      errorFreemail:
        "Companies need to register with a company e-mail address, not a free-mail one. Please sign up again with your work address.",
      errorGeneric:
        "Workspace setup failed — please try again or contact service@surpluspurpose.com."
    },
    invitation: {
      eyebrow: "Invitation",
      activateTitle: "Activate workspace",
      linkRequiredTitle: "Invitation link required",
      activateLead: "Use this signed-in session to connect your invitation to the correct workspace.",
      linkRequiredLead: "Use the invitation link from sur.plus so the workspace role can be verified.",
      activating: "Activating…",
      activate: "Activate access",
      notConfigured: "Sign in is not configured.",
      openLink: "Open the invitation link from your email to activate access.",
      signInFirst: "Sign in first, then activate the invitation again.",
      activationFailed: "Activation failed:",
      activationFailedGeneric: "Activation failed.",
      activated: "Workspace activated."
    },
    session: {
      eyebrow: "Session",
      signedIn: "Signed in",
      signIn: "Sign in",
      demo: "Demo",
      signOut: "Sign out",
      sending: "Sending…",
      sendLink: "Send link",
      emailPlaceholder: "name@company.org",
      previewAccess: "Preview access",
      notConfigured: "Supabase Auth is not configured.",
      enterEmail: "Enter an email first.",
      magicLinkSent: "Check your email for the sign-in link.",
      signInFailed: "Sign-in failed:",
      signOutFailed: "Sign-out failed:",
      signedOut: "Signed out."
    },
    hero: {
      eyebrow: "Value moved",
      caption:
        "Surplus value from companies delivered to verified non-profits — documented, not estimated.",
      statMatches: "Matches",
      statNgos: "NGOs",
      statWeight: "Diverted from waste",
      statCo2: "CO₂ saved",
      fallbackTitle: "Surplus becomes impact.",
      fallbackSub:
        "One workspace that turns corporate surplus into audit-ready impact for verified NGOs — matched, delivered, documented."
    },
    twoFactorSetup: {
      notAvailable: "Two-factor authentication is available once you sign in to your workspace.",
      eyebrow: "Account security",
      heading: "Two-factor authentication",
      lead: "Sign in with a one-time code from an authenticator app.",
      enable: "Enable two-factor authentication",
      starting: "Starting…",
      scanLead: "Scan with your authenticator app, then enter the 6-digit code.",
      qrAlt: "Two-factor authentication QR code",
      manualKey: "Or enter this key manually:",
      verifyEnable: "Verify and enable",
      verifying: "Verifying…",
      enabled: "Two-factor authentication is enabled.",
      errStart: "Could not start 2FA:",
      errFailed: "2FA failed:",
      errInvalidCode: "Invalid code:"
    },
    agreement: {
      eyebrow: "Agreement",
      accepted: "Accepted · version",
      reviewTerms: "Review terms",
      iAgreePrefix: "I have read and accept the ",
      iAgreeSuffixPre: " (version ",
      iAgreeSuffixPost: ").",
      accept: "Accept",
      saving: "Saving…",
      availableOnSignin: "Available once you sign in.",
      errSave: "Could not save:"
    }
  },
  header: {
    eyebrow: "Demo workspace · Sample data",
    titles: {
      corporate: "Turn surplus into documented impact",
      ngo: "Receive verified surplus for your mission",
      admin: "Run the loop: matching, logistics, evidence",
      editor: "Run the loop: matching, logistics, evidence"
    },
    subtitles: {
      corporate:
        "Explore the full surplus-to-NGO loop with realistic sample content. Everything here is a sandbox — changes are not persisted and reset regularly.",
      ngo: "Post needs, confirm incoming goods and download receipts. Everything here is a sandbox — changes are not persisted and reset regularly.",
      admin:
        "Verify NGOs, coordinate logistics and approve agent proposals. Everything here is a sandbox — changes are not persisted and reset regularly.",
      editor:
        "Verify NGOs, coordinate logistics and clear risk tasks. Plan and CO₂ changes stay with Ops admin."
    },
    pulseLead: "From your Pulse assessment:",
    pulseBody: (quantity: number, title: string) =>
      `${quantity} × ${title} are already listed below — this is how your workspace would look on day one.`,
    noticeLead:
      "This is not your data. Customer workspaces open with your onboarding — access is invite-based, there is no self-signup.",
    noticeBook: "Book a 30-min session",
    noticeMiddle: "or start at"
  },
  routes: {
    matches: {
      title: "Matches and logistics",
      subtitle:
        "Every match, its pickup and delivery status, and the conversation that keeps it auditable — in one place."
    },
    inbox: {
      title: "Inbox",
      subtitle:
        "Every match conversation in one place. Each thread stays tied to its match and remains auditable — logistics, document review and contact decisions never scatter."
    },
    listings: {
      title: "Your surplus listings",
      subtitle:
        "List surplus — furniture, IT, textiles or tools — and sur.plus matches it with a verified NGO. Every match becomes documented, reportable impact."
    },
    cases: {
      title: "Donation cases",
      subtitle:
        "One case holds contact, location, time window and every position in the donation — import a list or add positions by hand."
    },
    needs: {
      title: "What your NGO needs",
      subtitle:
        "Post what your NGO can use and sur.plus matches it with corporate surplus — with a donation certificate and CSRD note generated on every completed match."
    },
    documents: {
      title: "Certificates, reports and audit-ready proof",
      subtitle:
        "Every document here is generated from a completed match — never estimated. The donation certificate and the CSRD note are what turn a delivery into reportable impact."
    },
    impact: {
      title: "Impact & CSRD documentation",
      subtitle:
        "Your live, audit-ready impact — computed from completed matches and ready to export as an ESRS-aligned CSRD report."
    },
    account: {
      title: "Account & organisation",
      subtitle:
        "Your profile, security, team and plan — everything about your sur.plus account in one place."
    }
  },
  account: {
    eyebrow: "Account",
    organisation: "Organisation",
    role: "Role",
    verification: "Verification",
    profileTitle: "Profile",
    securityTitle: "Security",
    securityLead: "Add a second factor (authenticator app) so a stolen password is not enough to sign in.",
    membersTitle: "Team & invitations",
    planTitle: "Plan & billing",
    planNgoFree: "NGOs use sur.plus free of charge — no subscription, no fees.",
    planCurrent: "Current plan"
  },
  inbox: {
    eyebrow: "Conversations",
    threadsTitle: "Threads",
    threadsLead: "One thread per match. Select a conversation to read and reply.",
    counterpartyCorporate: "NGO",
    counterpartyNgo: "Corporate",
    noMessages: "No messages yet",
    selectPrompt: "Select a thread",
    selectHint: "Pick a match on the left to open its conversation.",
    emptyTitle: "No conversations yet",
    emptyHint: "A conversation opens with your first match and keeps logistics, document review and contact decisions in one auditable place.",
    emptyNext: "A match opens your first thread"
  },
  impact: {
    eyebrow: "Live impact",
    kpiValue: "Social Resource Value",
    kpiCo2: "Scope 3 emissions avoided",
    kpiMatches: "Verified matches",
    kpiNgos: "Verified beneficiaries",
    kpiCountries: "Countries reached",
    kpiWeight: "Diverted from disposal",
    e5Title: "E5 — Resource use & circular economy",
    e5Lead:
      "Surplus kept in the highest-value loop — direct reuse (R3) ahead of recycling or recovery, per the EU waste hierarchy.",
    e1Title: "E1 — Climate: Scope 3 avoided emissions",
    e1Lead:
      "Emissions avoided by redirecting surplus to reuse instead of disposal and new production (GHG Protocol, Scope 3 Cat. 12).",
    s3Title: "S3 — Affected communities",
    s3Lead:
      "Verified non-profits that received surplus this period. Each is independently verified before onboarding.",
    geoTitle: "Geographic reach",
    colCategory: "Category",
    colUnits: "Units",
    colWeight: "Weight diverted",
    colValue: "Value",
    colCo2: "CO₂e avoided",
    colDate: "Date",
    colNgo: "NGO",
    colCountry: "Country",
    colNgos: "NGOs",
    colMatches: "Matches",
    colValueTransferred: "Value transferred",
    total: "Total",
    exportCta: "Export CSRD report",
    methodology:
      "All figures are based on completed, NGO-confirmed matches. CO₂e uses life-cycle emission factors per category (GHG Protocol). Values reflect declared procurement value. Prepared in line with ESRS under CSRD.",
    emptyTitle: "No completed matches yet",
    emptyBody:
      "Once a match is confirmed and received, its audited impact appears here — ready for your ESRS E5, E1 and S3 disclosures."
  },
  resources: {
    eyebrow: "Make it count",
    title: "Get the most from this delivery"
  },
  forms: {
    common: {
      close: "Close",
      optional: "(optional)",
      category: "Category",
      subcategory: "Subcategory",
      selectCategory: "Select a category…",
      selectSubcategory: "Select a subcategory…",
      chooseCategoryFirst: "Choose a category first",
      city: "City",
      country: "Country",
      selectCountry: "Select a country…",
      cityPlaceholder: "München",
      failedPrefix: "failed:",
      networkError: "network_error",
      authRequired: "auth_required"
    },
    listing: {
      eyebrow: "Surplus intake",
      heading: "List surplus",
      addButton: "+ List surplus",
      leadCollapsed: "Describe it once — sur.plus matches it with a verified NGO within 72 hours.",
      lead:
        "Describe the surplus once — sur.plus matches it with a verified NGO and prepares the documentation. Photos can be added right after posting; your listing opens with an upload box.",
      title: "Title",
      titlePlaceholder: "e.g. 24 ergonomic office chairs, black, from our Munich office clear-out",
      condition: "Condition",
      conditionPlaceholder: "Good, used",
      conditionNew: "New",
      conditionLikeNew: "Like new",
      conditionGoodUsed: "Good, used",
      conditionFunctionalWorn: "Functional, worn",
      quantity: "Quantity",
      quantityPlaceholder: "24",
      unit: "Unit",
      unitPlaceholder: "pieces",
      unitValue: "Value per unit (€)",
      unitValuePlaceholder: "80",
      showOptional: "Add optional details (pickup, packaging, weight …)",
      hideOptional: "Hide optional details",
      availableUntil: "Available until",
      pickupWindow: "Pickup window",
      pickupWindowPlaceholder: "Weekdays 9–16h",
      packaging: "Packaging",
      packagingPlaceholder: "On pallets",
      weightKg: "Total weight (kg)",
      weightPlaceholder: "350",
      categoryDetails: "Category details",
      categoryDetailsPlaceholder: "Anything the NGO should know: models, sizes, accessories …",
      eligibilityLegend: "Eligibility check",
      eligibilityUsable: "The goods are usable and in working condition.",
      eligibilityPolicyFit:
        "The goods fit sur.plus policy (office/facility surplus, no restricted items).",
      eligibilityOwnership: "Our company owns these goods and may donate them.",
      eligibilityConfirmed: "All eligibility checks confirmed.",
      eligibilityPending: "Confirm all three eligibility checks to submit.",
      submit: "Create listing",
      submitPending: "Creating…",
      errQuantityPositive: "quantity must be a positive number.",
      errUnitValueNonNegative: "value per unit must be zero or more.",
      errWeightNumber: "weight must be a number.",
      created: "Listing created — refreshing the workspace…"
    },
    need: {
      eyebrow: "Needs intake",
      heading: "Post a need",
      addButton: "+ Post a need",
      leadCollapsed: "Tell companies what your organization needs. Matching starts here.",
      lead:
        "One item per need — post laptops and monitors separately and we can match them separately. Don’t know the exact number yet? Leave it blank.",
      title: "Title",
      titlePlaceholder: "e.g. Laptops for evening classes",
      howMany: "How many?",
      howManyPlaceholder: "20",
      anyAmount: "Any quantity — we can always use these",
      maxPerMatch: "Max per match",
      maxPerMatchPlaceholder: "e.g. 20",
      maxPerMatchHint: "Optional cap so one company does not cover everything at once.",
      whenNeeded: "When do you need it?",
      urgencyAsap: "As soon as possible",
      urgencyFlexible: "Whenever something is available",
      urgencyByDate: "Needed by a certain date",
      urgencyOngoing: "Ongoing — we can always use these",
      neededByDateAria: "Needed by date",
      peopleReached: "People reached",
      peopleReachedPlaceholder: "180",
      targetGroup: "Target group",
      targetGroupPlaceholder: "e.g. Evening-class participants aged 16–25",
      deliveryPreference: "Delivery preference",
      deliveryCollect: "We collect",
      deliveryShip: "Please ship to us",
      deliveryEither: "Either works",
      deliveryAddress: "Delivery address",
      deliveryAddressPlaceholder: "Street, building, door — may differ from your registered address",
      deliveryAddressHint: "City and country above are the locality; this line is the handover point.",
      hasVehicle: "We have a vehicle for collection",
      story: "Why this matters — who benefits?",
      storyPlaceholder:
        "Be concrete: who uses them, for what, how many people it reaches. This is what makes a company pick your need.",
      words: "words",
      atLeast: "At least",
      wordsShort: "words",
      soFar: "so far.",
      submit: "Post need",
      submitPending: "Posting…",
      errQuantityPositive: "if you give a number, it has to be a positive one.",
      errBeneficiariesNonNegative: "beneficiaries must be zero or more.",
      errMaxPerMatchPositive: "max per match must be a positive whole number.",
      posted: "Need posted — refreshing the workspace…"
    }
  }
};

export type Dictionary = typeof en;

const de: Dictionary = {
  platformTag: "Plattform · Demo",
  workspaceTag: "Workspace",
  workspacePreviewWarning:
    "Supabase ist konfiguriert, aber nicht erreichbar — diese Anfrage nutzt daher Vorschaudaten:",
  aria: {
    language: "Sprache",
    perspective: "Workspace-Perspektive",
    workspaceNav: "Workspace-Navigation",
    sections: "Workspace-Abschnitte"
  },
  nav: {
    navigate: "Navigation",
    resources: "sur.plus",
    groupWork: "Arbeit",
    groupEvidence: "Nachweise & Wirkung",
    groupAccount: "Organisation",
    overview: "Übersicht",
    workspace: "Workspace",
    matches: "Matches",
    inbox: "Postfach",
    listings: "Angebote",
    cases: "Fälle",
    needs: "Bedarfe",
    evidenceImpact: "Nachweise & Wirkung",
    impact: "Wirkung",
    account: "Konto",
    needsEvidence: "Bedarfe & Nachweise",
    starterPackage: "Starter-Paket",
    members: "Mitglieder",
    plans: "Tarife",
    verification: "Verifizierung",
    ngos: "NGOs",
    companies: "Unternehmen",
    requests: "Anfragen",
    admins: "Admins",
    approvals: "Freigaben",
    controls: "Kontrollen",
    bookSession: "Termin buchen",
    landingPage: "Landingpage"
  },
  shell: {
    sandbox: "Sandbox · setzt zurück",
    imprint: "Impressum",
    privacy: "Datenschutz"
  },
  // Rendered uppercase with wide tracking in a 248px sidebar — keep short or it
  // truncates. "NGO · immer kostenfrei" did.
  tiers: {
    corporate: "Seed-Workspace",
    ngo: "NGO · kostenfrei",
    admin: "Interne Konsole",
    editor: "Ops-Editor"
  },
  demoStart: {
    eyebrow: "Live-Demo",
    title: "sur.plus mit Beispieldaten ausprobieren",
    lead: "Sie erhalten Ihre eigene, private Spielwiese mit erfundenen Unternehmen, Organisationen und Vermittlungen. Gehen Sie den ganzen Ablauf durch; nichts davon sehen andere oder berührt echte Daten.",
    pick: "Starten als",
    corporate: "Unternehmen mit Überschuss",
    ngo: "Gemeinnützige Organisation mit Bedarf",
    admin: "sur.plus Ops",
    start: "Meine Demo starten",
    note: "Ihre Spielwiese wird nach zwei Stunden ohne Aktivität automatisch gelöscht.",
    expired: "Ihre Demo ist abgelaufen. Starten Sie eine neue."
  },
  requestAccess: {
    eyebrow: "Noch keine Einladung?",
    title: "Zugang anfragen",
    lead: "Sagen Sie uns, wer Sie sind, und wir melden uns persönlich bei Ihnen. Ihre Angaben werden nicht an andere Organisationen weitergegeben.",
    link: "Zugang anfragen",
    nameLabel: "Ihr Name",
    organizationLabel: "Organisation",
    roleLabel: "Wir sind …",
    roleCorporate: "Unternehmen mit Überschuss",
    roleNgo: "Gemeinnützige Organisation mit Bedarf",
    emailLabel: "Geschäftliche E-Mail",
    phoneLabel: "Telefon (optional)",
    messageLabel: "Was möchten Sie erreichen? (optional)",
    consentBefore: "Ich habe die",
    consentLink: "Datenschutzerklärung",
    consentAfter: "gelesen und bin einverstanden, dass sur.plus mich zu meiner Anfrage kontaktiert.",
    submit: "Anfrage senden",
    sending: "Wird gesendet …",
    doneTitle: "Danke – Ihre Anfrage ist bei uns",
    doneBody: "Wir melden uns unter der angegebenen Adresse. Schon eingeladen? Melden Sie sich stattdessen über den Einladungslink an.",
    backToLogin: "Zurück zur Anmeldung",
    errors: {
      invalid_name: "Bitte geben Sie Ihren Namen an.",
      invalid_organization: "Bitte geben Sie Ihre Organisation an.",
      invalid_role: "Bitte wählen Sie, was auf Sie zutrifft.",
      invalid_email: "Bitte geben Sie eine gültige E-Mail-Adresse an.",
      invalid_phone: "Die Telefonnummer ist zu lang.",
      invalid_message: "Ihre Nachricht ist zu lang.",
      consent_required: "Bitte bestätigen Sie die Datenschutzerklärung.",
      rate_limit_exceeded: "Zu viele Versuche. Bitte versuchen Sie es in einigen Minuten erneut.",
      generic: "Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut."
    }
  },
  auth: {
    tag: "Anmelden",
    eyebrow: "Impact Space",
    title: "Anmelden",
    subtitle:
      "Zugang für Corporate- und NGO-Workspaces. Melde dich mit E-Mail und Passwort an.",
    inviteNotice:
      "Du nimmst eine Einladung an. Melde dich mit der eingeladenen E-Mail-Adresse an, um fortzufahren.",
    demoCta: "Live-Demo ansehen",
    accessLead: "Lieber mit Begleitung starten?",
    accessCta: "30-Minuten-Termin buchen",
    register: {
      orgNameMissing: "Bitte gib den Namen eurer Organisation an.",
      salutationLabel: "Anrede",
      salutationPlaceholder: "Anrede",
      salutationHerr: "Herr",
      salutationFrau: "Frau",
      salutationDivers: "Divers",
      salutationMissing: "Bitte wähle eine Anrede.",
      academicTitleLabel: "Akademischer Titel",
      academicTitleNone: "Kein Titel",
      firstNamePlaceholder: "Vorname — z. B. Maria",
      lastNamePlaceholder: "Nachname — z. B. Muster",
      firstNameMissing: "Bitte gib deinen Vornamen an.",
      lastNameMissing: "Bitte gib deinen Nachnamen an.",
      orgTypeLabel: "Art der Organisation",
      orgTypePlaceholder: "Art der Organisation",
      orgTypeVerein: "Gemeinnütziger Verein (e.V.)",
      orgTypeGgmbh: "Gemeinnützige GmbH / UG (gGmbH/gUG)",
      orgTypeStiftung: "Gemeinnützige Stiftung",
      orgTypePublicBody: "Öffentliche Einrichtung (Schule, Kita, Gemeinde)",
      orgTypeFreierTraeger: "Einrichtung in freier/kirchlicher Trägerschaft",
      orgTypeMissing: "Bitte wähle die Art deiner Organisation.",
      corporateFreemail:
        "Bitte registriere dich mit deiner Firmen-E-Mail-Adresse — Freemail-Adressen (Gmail, GMX, web.de, Outlook …) sind für Unternehmen nicht zugelassen.",
      rolePlaceholder: "Deine Rolle (optional) — z. B. Facility Manager",
      phonePlaceholder: "Telefon (optional)",
      confirmEyebrow: "Nur noch eine E-Mail",
      confirmTitle: "Bestätige deine E-Mail-Adresse",
      confirmBodyBefore: "Wir haben einen Bestätigungslink geschickt an",
      confirmBodyAfter: "Ein Klick, und die Einrichtung deines Workspace geht genau dort weiter.",
      confirmHint: "Nichts im Postfach? Schau in den Spam-Ordner oder warte eine Minute — der Link kommt von service@surpluspurpose.com.",
      confirmBack: "Zurück zur Anmeldung",
      orgNamePlaceholderNgo: "Name der Organisation — z. B. Hilfe e.V.",
      orgNamePlaceholderCorporate: "Name des Unternehmens — z. B. Beispiel GmbH",
      chooseTitle: "Zuerst — wer bist du?",
      chooseLead: "Dein Pfad unterscheidet sich je nach Organisationstyp. Wähle einen, um fortzufahren.",
      ngo: "Ich bin eine NGO",
      ngoHint: "Dauerhaft kostenlos. Wir verifizieren eure Organisation, dann öffnet euer Workspace.",
      corporate: "Ich bin ein Unternehmen",
      corporateHint: "Überschuss listen und prüfsichere Impact-Dokumentation erhalten. Wir richten euren Workspace ein.",
      change: "Ändern",
      continueNgo: "NGO-Konto erstellen",
      continueCorporate: "Unternehmenskonto erstellen",
      consentLead: "Bevor du fortfährst, bitte bestätigen:",
      consentBefore: "Ich akzeptiere die",
      consentPrivacyLink: "Datenschutzerklärung",
      consentTermsCorporate: "Nutzungsbedingungen",
      consentTermsNgo: "Partnervereinbarung",
      consentRequired: "Bitte bestätige beides, um dein Konto zu erstellen."
    },
    password: {
      heading: "Dein Passwort braucht:",
      aria: "Passwort-Anforderungen",
      length: "mindestens 8 Zeichen",
      upper: "einen Großbuchstaben (A–Z)",
      lower: "einen Kleinbuchstaben (a–z)",
      digit: "eine Zahl (0–9)",
      symbol: "ein Sonderzeichen (! ? # € …)",
      incomplete: "Dein Passwort erfüllt noch nicht alle Anforderungen — siehe die Liste unten."
    },
    panel: {
      unavailable: "Die Anmeldung ist in der veröffentlichten App verfügbar.",
      emailPlaceholder: "name@firma.de",
      passwordPlaceholder: "Passwort",
      newPasswordPlaceholder: "Neues Passwort",
      showPassword: "Passwort anzeigen",
      hidePassword: "Passwort verbergen",
      signIn: "Anmelden",
      createAccount: "Konto erstellen",
      working: "Einen Moment…",
      sending: "Wird gesendet…",
      magicLink: "Stattdessen Anmelde-Link per E-Mail",
      forgotPassword: "Passwort vergessen?",
      toSignup: "Neu hier? Konto erstellen",
      toSignin: "Schon ein Konto? Anmelden",
      googleRedirecting: "Weiterleitung…",
      googleContinue: "Mit Google fortfahren",
      or: "oder",
      recoveryTitle: "Neues Passwort festlegen",
      recoveryLead:
        "Du hast einen Link zum Zurücksetzen geöffnet. Wähle ein neues Passwort — danach wirst du direkt angemeldet.",
      recoverySaving: "Wird gespeichert…",
      recoverySet: "Neues Passwort speichern",
      mfaTitle: "Zwei-Faktor-Bestätigung",
      mfaLead: "Gib den 6-stelligen Code aus deiner Authenticator-App ein.",
      mfaVerifying: "Wird geprüft…",
      mfaVerify: "Bestätigen",
      enterEmailPassword: "Gib deine E-Mail und dein Passwort ein.",
      enterPassword: "Gib dein Passwort ein.",
      enterEmail: "Gib zuerst deine E-Mail ein.",
      enterEmailReset: "Gib zuerst deine E-Mail ein, dann fordere den Link zum Zurücksetzen an.",
      magicLinkSent: "Schau in dein Postfach — der Anmelde-Link ist unterwegs.",
      resetSent: "Falls ein Konto existiert, ist ein Link zum Zurücksetzen unterwegs.",
      passwordUpdated: "Passwort aktualisiert — du wirst angemeldet…",
      googleFailed: "Google-Anmeldung fehlgeschlagen:",
      signUpFailed: "Registrierung fehlgeschlagen:",
      signInFailed: "Anmeldung fehlgeschlagen:",
      mfaFailed: "2FA fehlgeschlagen:",
      invalidCode: "Ungültiger Code:",
      setPasswordFailed: "Passwort konnte nicht gesetzt werden:",
      resetFailed: "Zurücksetzen fehlgeschlagen:",
      recoveryChecking: "Reset-Link wird geprüft …",
      recoveryInvalid:
        "Dieser Reset-Link ist ungültig oder abgelaufen. Fordere auf der Login-Seite einen neuen an.",
      recoveryBackToLogin: "Zurück zur Anmeldung",
      confirmPasswordPlaceholder: "Neues Passwort wiederholen",
      passwordsDontMatch: "Die beiden Passwörter stimmen noch nicht überein.",
      captchaRequired: "Bitte zuerst die Bot-Prüfung abschließen.",
      emailNotConfirmed: "Bitte bestätige zuerst deine E-Mail-Adresse — schau in dein Postfach oder sende den Link unten erneut.",
      resendConfirmation: "Bestätigungs-E-Mail erneut senden",
      confirmationResent: "Bestätigungs-E-Mail gesendet — schau in dein Postfach.",
      errInvalidCredentials: "Falsche E-Mail oder falsches Passwort.",
      errRateLimited: "Zu viele Versuche — bitte warte einen Moment und versuch es erneut.",
      errUserExists: "Mit dieser E-Mail existiert bereits ein Konto — bitte melde dich an.",
      errWeakPassword: "Dieses Passwort ist zu schwach — es muss alle Anforderungen unten erfüllen.",
      errInvalidEmail: "Bitte gib eine gültige E-Mail-Adresse ein.",
      errSamePassword: "Wähle ein anderes Passwort als dein aktuelles.",
      errGeneric: "Etwas ist schiefgelaufen. Bitte versuch es erneut."
    },
    registered: {
      eyebrow: "Registrierung",
      titleConfirmed: "Du bist registriert",
      leadConfirmed: "Dein Konto ist eingerichtet. Weiter – wir bringen dich in die App.",
      titlePending: "Registrierung eingegangen",
      leadPending:
        "Fast geschafft – bestätige den Link in der E-Mail, die wir dir geschickt haben. Nicht angekommen? Melde dich an, dann bieten wir dir das erneute Senden an.",
      continueCta: "Weiter",
      toSignin: "Zur Anmeldung",
      checking: "Registrierung wird abgeschlossen …"
    },
    ticker: {
      eyebrow: "Seit du diese Seite geöffnet hast",
      caption: "an brauchbaren Gütern weltweit vernichtet oder verschwendet — genau diese Lücke schließt sur.plus."
    },
    provisioning: {
      eyebrow: "Kontozugang",
      title: "Nur noch ein Schritt",
      lead: "Deine Anmeldung ist gültig. Verbinde dieses Konto mit einem Workspace und du bist drin — entweder unten oder indem du eine erhaltene Einladung annimmst.",
      supportRef: "Support-Referenz",
      emailLabel: "E-Mail:",
      userIdLabel: "Auth-Benutzer-ID:",
      notAvailable: "Nicht verfügbar"
    },
    adminMfa: {
      eyebrow: "Ops-Sicherheit",
      title: "Zwei-Faktor-Authentifizierung ist Pflicht",
      lead: "Admin-Konten brauchen einen zweiten Faktor. Richte unten eine Authenticator-App ein."
    },
    roleRequired: {
      eyebrow: "Zugriffsgrenze",
      title: "sur.plus-Ops-Zugang erforderlich",
      body: (required: string, active: string) =>
        `Dieser Workspace ist auf ${required}-Nutzer beschränkt. Deine aktuelle Sitzung gilt als ${active}. Die URL gewährt keine zusätzlichen Rechte.`,
      switcherAria: "Vorschau-Rolle",
      bootstrap: "Ops einrichten",
      roles: {
        corporate: { label: "Corporate", detail: "Angebote und Nachweise" },
        ngo: { label: "NGO", detail: "Bedarfe und eingehende Waren" },
        admin: { label: "sur.plus Ops", detail: "Interne Rolle nach Anmeldung" }
      }
    },
    claim: {
      ngoEyebrow: "NGO-Workspace",
      corporateEyebrow: "Unternehmens-Workspace",
      ngoLead:
        "Bestätige den Namen deiner Organisation und hänge deinen Nachweis an — dann öffnet sich dein Workspace. Ops prüft den Nachweis; das Matching wird freigeschaltet, sobald du verifiziert bist.",
      corporateLead:
        "Bestätige den Namen deines Unternehmens und dein Workspace öffnet sich: Durchsuche anonymisierte Bedarfe verifizierter NGOs. Wer sie sind, Kontakt und Matching werden mit einem Tarif freigeschaltet.",
      orgNameAria: "Name der Organisation",
      ngoPlaceholder: "Name der Organisation — z. B. Hilfe e.V.",
      corporatePlaceholder: "Firmenname — z. B. Beispiel GmbH",
      proofLabel: "Nachweis (Pflicht)",
      proofHint: "PDF oder Bild — z. B. Freistellungsbescheid oder Nachweis des öffentlich-rechtlichen Status.",
      proofChoose: "Datei wählen",
      proofRequired: "Bitte hänge deinen Nachweis an, um fortzufahren.",
      proofUploadFailed:
        "Dein Workspace ist offen, aber der Nachweis-Upload ist fehlgeschlagen — du kannst ihn im Dashboard nachreichen.",
      settingUp: "Wird eingerichtet…",
      openWorkspace: "Meinen Workspace öffnen",
      errorNetwork: "Netzwerkfehler — bitte versuche es erneut.",
      errorInvalidName: "Bitte gib den vollständigen Namen deiner Organisation ein (mindestens 2 Zeichen).",
      errorNoRole:
        "Für dieses Konto ist kein Organisationstyp hinterlegt — bitte kontaktiere service@surpluspurpose.com.",
      errorNotAuthenticated: "Deine Sitzung ist abgelaufen — bitte melde dich erneut an.",
      errorFreemail:
        "Unternehmen registrieren sich mit einer Firmen-E-Mail-Adresse, nicht mit Freemail. Bitte registriere dich erneut mit deiner geschäftlichen Adresse.",
      errorGeneric:
        "Einrichtung des Workspace fehlgeschlagen — bitte versuche es erneut oder kontaktiere service@surpluspurpose.com."
    },
    invitation: {
      eyebrow: "Einladung",
      activateTitle: "Workspace aktivieren",
      linkRequiredTitle: "Einladungslink erforderlich",
      activateLead: "Nutze diese angemeldete Sitzung, um deine Einladung mit dem richtigen Workspace zu verbinden.",
      linkRequiredLead: "Nutze den Einladungslink von sur.plus, damit die Workspace-Rolle geprüft werden kann.",
      activating: "Wird aktiviert…",
      activate: "Zugang aktivieren",
      notConfigured: "Die Anmeldung ist nicht konfiguriert.",
      openLink: "Öffne den Einladungslink aus deiner E-Mail, um den Zugang zu aktivieren.",
      signInFirst: "Melde dich zuerst an und aktiviere die Einladung dann erneut.",
      activationFailed: "Aktivierung fehlgeschlagen:",
      activationFailedGeneric: "Aktivierung fehlgeschlagen.",
      activated: "Workspace aktiviert."
    },
    session: {
      eyebrow: "Sitzung",
      signedIn: "Angemeldet",
      signIn: "Anmelden",
      demo: "Demo",
      signOut: "Abmelden",
      sending: "Wird gesendet…",
      sendLink: "Link senden",
      emailPlaceholder: "name@firma.de",
      previewAccess: "Vorschau-Zugang",
      notConfigured: "Supabase Auth ist nicht konfiguriert.",
      enterEmail: "Gib zuerst eine E-Mail ein.",
      magicLinkSent: "Schau in dein Postfach — der Anmelde-Link ist unterwegs.",
      signInFailed: "Anmeldung fehlgeschlagen:",
      signOutFailed: "Abmeldung fehlgeschlagen:",
      signedOut: "Abgemeldet."
    },
    hero: {
      eyebrow: "Vermittelt",
      caption:
        "Warenwert von Unternehmen an geprüfte gemeinnützige Organisationen — dokumentiert, nicht geschätzt.",
      statMatches: "Matches",
      statNgos: "NGOs",
      statWeight: "Vor der Tonne bewahrt",
      statCo2: "CO₂ eingespart",
      fallbackTitle: "Überschuss wird Wirkung.",
      fallbackSub:
        "Ein Workspace, der Unternehmens-Überschuss in prüfsichere Wirkung für geprüfte NGOs verwandelt — vermittelt, geliefert, dokumentiert."
    },
    twoFactorSetup: {
      notAvailable: "Die Zwei-Faktor-Authentifizierung steht dir zur Verfügung, sobald du dich in deinem Workspace anmeldest.",
      eyebrow: "Konto-Sicherheit",
      heading: "Zwei-Faktor-Authentifizierung",
      lead: "Melde dich mit einem Einmalcode aus einer Authenticator-App an.",
      enable: "Zwei-Faktor-Authentifizierung aktivieren",
      starting: "Wird gestartet…",
      scanLead: "Mit der Authenticator-App scannen, dann den 6-stelligen Code eingeben.",
      qrAlt: "QR-Code für die Zwei-Faktor-Authentifizierung",
      manualKey: "Oder gib diesen Schlüssel manuell ein:",
      verifyEnable: "Bestätigen und aktivieren",
      verifying: "Verifiziere…",
      enabled: "Die Zwei-Faktor-Authentifizierung ist aktiviert.",
      errStart: "2FA konnte nicht gestartet werden:",
      errFailed: "2FA fehlgeschlagen:",
      errInvalidCode: "Ungültiger Code:"
    },
    agreement: {
      eyebrow: "Vereinbarung",
      accepted: "Akzeptiert · Version",
      reviewTerms: "Bedingungen ansehen",
      iAgreePrefix: "Ich habe die ",
      iAgreeSuffixPre: " (Version ",
      iAgreeSuffixPost: ") gelesen und akzeptiere sie.",
      accept: "Akzeptieren",
      saving: "Speichern…",
      availableOnSignin: "Nach dem Anmelden verfügbar.",
      errSave: "Konnte nicht gespeichert werden:"
    }
  },
  header: {
    eyebrow: "Demo-Workspace · Beispieldaten",
    titles: {
      corporate: "Überschuss in belegbare Wirkung verwandeln",
      ngo: "Geprüften Überschuss für eure Mission erhalten",
      admin: "Den Loop steuern: Matching, Logistik, Nachweise",
      editor: "Den Loop steuern: Matching, Logistik, Nachweise"
    },
    subtitles: {
      corporate:
        "Erkunde den kompletten Weg vom Überschuss zur NGO mit realistischen Beispielinhalten. Alles hier ist eine Sandbox — Änderungen werden nicht gespeichert und regelmäßig zurückgesetzt.",
      ngo: "Bedarfe posten, eingehende Waren bestätigen, Belege herunterladen. Alles hier ist eine Sandbox — Änderungen werden nicht gespeichert und regelmäßig zurückgesetzt.",
      admin:
        "NGOs verifizieren, Logistik koordinieren, Agenten-Vorschläge freigeben. Alles hier ist eine Sandbox — Änderungen werden nicht gespeichert und regelmäßig zurückgesetzt.",
      editor:
        "NGOs verifizieren, Logistik koordinieren, Risiko-Aufgaben erledigen. Plan- und CO₂-Änderungen bleiben beim Ops-Admin."
    },
    pulseLead: "Aus eurer Pulse-Auswertung:",
    pulseBody: (quantity: number, title: string) =>
      `${quantity} × ${title} sind unten bereits gelistet — so sähe euer Workspace am ersten Tag aus.`,
    noticeLead:
      "Das sind nicht eure Daten. Kunden-Workspaces starten mit eurem Onboarding — der Zugang ist einladungsbasiert, es gibt keine Selbstregistrierung.",
    noticeBook: "30-Minuten-Termin buchen",
    noticeMiddle: "oder startet auf"
  },
  routes: {
    matches: {
      title: "Matches und Logistik",
      subtitle:
        "Jedes Match, sein Abhol- und Lieferstatus und die Konversation, die alles nachvollziehbar hält — an einem Ort."
    },
    inbox: {
      title: "Postfach",
      subtitle:
        "Alle Match-Konversationen an einem Ort. Jeder Thread bleibt an sein Match gebunden und nachvollziehbar — Logistik, Dokumentprüfung und Kontaktentscheidungen zersplittern nie."
    },
    listings: {
      title: "Eure Überschuss-Angebote",
      subtitle:
        "Listet Überschuss — Möbel, IT, Textilien oder Werkzeuge — und sur.plus matcht ihn mit einer geprüften NGO. Jedes Match wird zu belegbarer, berichtsfähiger Wirkung."
    },
    cases: {
      title: "Spendenfälle",
      subtitle:
        "Ein Fall hält Kontakt, Standort, Zeitfenster und jede Position der Spende — Liste importieren oder Positionen manuell ergänzen."
    },
    needs: {
      title: "Was eure NGO braucht",
      subtitle:
        "Postet, was eure NGO nutzen kann, und sur.plus matcht es mit Unternehmens-Überschuss — mit Spendenbescheinigung und CSRD-Notiz bei jedem abgeschlossenen Match."
    },
    documents: {
      title: "Bescheinigungen, Reports und prüfsichere Nachweise",
      subtitle:
        "Jedes Dokument hier wird aus einem abgeschlossenen Match erzeugt — nie geschätzt. Die Spendenbescheinigung und die CSRD-Notiz machen aus einer Lieferung berichtsfähige Wirkung."
    },
    impact: {
      title: "Wirkung & CSRD-Dokumentation",
      subtitle:
        "Deine live berechnete, prüfsichere Wirkung — aus abgeschlossenen Matches, bereit zum Export als ESRS-konformer CSRD-Report."
    },
    account: {
      title: "Konto & Organisation",
      subtitle:
        "Profil, Sicherheit, Team und Plan — alles zu deinem sur.plus-Konto an einem Ort."
    }
  },
  account: {
    eyebrow: "Konto",
    organisation: "Organisation",
    role: "Rolle",
    verification: "Verifizierung",
    profileTitle: "Profil",
    securityTitle: "Sicherheit",
    securityLead: "Aktiviere einen zweiten Faktor (Authenticator-App), damit ein gestohlenes Passwort allein nicht zum Login reicht.",
    membersTitle: "Team & Einladungen",
    planTitle: "Plan & Abrechnung",
    planNgoFree: "NGOs nutzen sur.plus kostenlos — kein Abo, keine Gebühren.",
    planCurrent: "Aktueller Plan"
  },
  inbox: {
    eyebrow: "Konversationen",
    threadsTitle: "Threads",
    threadsLead: "Ein Thread pro Match. Wähle eine Konversation zum Lesen und Antworten.",
    counterpartyCorporate: "NGO",
    counterpartyNgo: "Corporate",
    noMessages: "Noch keine Nachrichten",
    selectPrompt: "Thread auswählen",
    selectHint: "Wähle links ein Match, um die Konversation zu öffnen.",
    emptyTitle: "Noch keine Konversationen",
    emptyHint: "Eine Konversation öffnet sich mit deinem ersten Match und hält Logistik, Dokumentprüfung und Kontaktentscheidungen an einem nachvollziehbaren Ort.",
    emptyNext: "Ein Match öffnet deinen ersten Thread"
  },
  impact: {
    eyebrow: "Live-Wirkung",
    kpiValue: "Social Resource Value",
    kpiCo2: "Vermiedene Scope-3-Emissionen",
    kpiMatches: "Verifizierte Matches",
    kpiNgos: "Verifizierte Empfänger",
    kpiCountries: "Erreichte Länder",
    kpiWeight: "Vor Entsorgung bewahrt",
    e5Title: "E5 — Ressourcennutzung & Kreislaufwirtschaft",
    e5Lead:
      "Überschuss im höchstwertigen Kreislauf gehalten — direkte Wiederverwendung (R3) vor Recycling oder Verwertung, gemäß EU-Abfallhierarchie.",
    e1Title: "E1 — Klima: vermiedene Scope-3-Emissionen",
    e1Lead:
      "Vermiedene Emissionen durch Wiederverwendung statt Entsorgung und Neuproduktion (GHG Protocol, Scope 3 Kat. 12).",
    s3Title: "S3 — Betroffene Gemeinschaften",
    s3Lead:
      "Verifizierte gemeinnützige Organisationen, die in diesem Zeitraum Überschuss erhalten haben. Jede wird vor dem Onboarding unabhängig geprüft.",
    geoTitle: "Geografische Reichweite",
    colCategory: "Kategorie",
    colUnits: "Einheiten",
    colWeight: "Umgelenktes Gewicht",
    colValue: "Wert",
    colCo2: "CO₂e vermieden",
    colDate: "Datum",
    colNgo: "NGO",
    colCountry: "Land",
    colNgos: "NGOs",
    colMatches: "Matches",
    colValueTransferred: "Transferierter Wert",
    total: "Gesamt",
    exportCta: "CSRD-Report exportieren",
    methodology:
      "Alle Zahlen basieren auf abgeschlossenen, NGO-bestätigten Matches. CO₂e nutzt Lebenszyklus-Emissionsfaktoren je Kategorie (GHG Protocol). Werte entsprechen dem angegebenen Beschaffungswert. Erstellt gemäß ESRS unter CSRD.",
    emptyTitle: "Noch keine abgeschlossenen Matches",
    emptyBody:
      "Sobald ein Match bestätigt und empfangen ist, erscheint seine geprüfte Wirkung hier — bereit für deine ESRS-E5-, E1- und S3-Angaben."
  },
  resources: {
    eyebrow: "Mehr rausholen",
    title: "Hol das Beste aus dieser Lieferung"
  },
  forms: {
    common: {
      close: "Schließen",
      optional: "(optional)",
      category: "Kategorie",
      subcategory: "Unterkategorie",
      selectCategory: "Kategorie wählen…",
      selectSubcategory: "Unterkategorie wählen…",
      chooseCategoryFirst: "Zuerst Kategorie wählen",
      city: "Stadt",
      country: "Land",
      selectCountry: "Land wählen…",
      cityPlaceholder: "München",
      failedPrefix: "fehlgeschlagen:",
      networkError: "Netzwerkfehler",
      authRequired: "Anmeldung erforderlich"
    },
    listing: {
      eyebrow: "Überschuss annehmen",
      heading: "Überschuss einstellen",
      addButton: "+ Überschuss einstellen",
      leadCollapsed:
        "Einmal beschreiben — sur.plus matcht ihn innerhalb von 72 Stunden mit einer geprüften NGO.",
      lead:
        "Beschreibe den Überschuss einmal — sur.plus matcht ihn mit einer geprüften NGO und bereitet die Dokumentation vor. Fotos kannst du direkt nach dem Einstellen hinzufügen; dein Angebot öffnet sich mit einem Upload-Feld.",
      title: "Titel",
      titlePlaceholder: "z. B. 24 ergonomische Bürostühle, schwarz, aus unserer Münchner Büroauflösung",
      condition: "Zustand",
      conditionPlaceholder: "Gut, gebraucht",
      conditionNew: "Neu",
      conditionLikeNew: "Wie neu",
      conditionGoodUsed: "Gut, gebraucht",
      conditionFunctionalWorn: "Funktionsfähig, mit Gebrauchsspuren",
      quantity: "Menge",
      quantityPlaceholder: "24",
      unit: "Einheit",
      unitPlaceholder: "Stück",
      unitValue: "Wert pro Stück (€)",
      unitValuePlaceholder: "80",
      showOptional: "Optionale Angaben ergänzen (Abholung, Verpackung, Gewicht …)",
      hideOptional: "Optionale Angaben ausblenden",
      availableUntil: "Verfügbar bis",
      pickupWindow: "Abholzeitfenster",
      pickupWindowPlaceholder: "Werktags 9–16 Uhr",
      packaging: "Verpackung",
      packagingPlaceholder: "Auf Paletten",
      weightKg: "Gesamtgewicht (kg)",
      weightPlaceholder: "350",
      categoryDetails: "Kategorie-Details",
      categoryDetailsPlaceholder: "Alles, was die NGO wissen sollte: Modelle, Größen, Zubehör …",
      eligibilityLegend: "Eignungs-Check",
      eligibilityUsable: "Die Waren sind brauchbar und funktionsfähig.",
      eligibilityPolicyFit:
        "Die Waren passen zur sur.plus-Richtlinie (Büro-/Betriebsüberschuss, keine eingeschränkten Artikel).",
      eligibilityOwnership: "Unser Unternehmen besitzt diese Waren und darf sie spenden.",
      eligibilityConfirmed: "Alle Eignungs-Checks bestätigt.",
      eligibilityPending: "Bestätige alle drei Eignungs-Checks, um abzusenden.",
      submit: "Angebot erstellen",
      submitPending: "Wird erstellt…",
      errQuantityPositive: "Die Menge muss eine positive Zahl sein.",
      errUnitValueNonNegative: "Der Wert pro Stück muss null oder mehr betragen.",
      errWeightNumber: "Das Gewicht muss eine Zahl sein.",
      created: "Angebot erstellt — Arbeitsbereich wird aktualisiert…"
    },
    need: {
      eyebrow: "Bedarf annehmen",
      heading: "Bedarf melden",
      addButton: "+ Bedarf melden",
      leadCollapsed: "Sag Unternehmen, was eure Organisation braucht. Das Matching startet hier.",
      lead:
        "Ein Artikel pro Bedarf — melde Laptops und Monitore getrennt, dann können wir sie getrennt matchen. Du kennst die genaue Anzahl noch nicht? Lass das Feld leer.",
      title: "Titel",
      titlePlaceholder: "z. B. Laptops für Abendkurse",
      howMany: "Wie viele?",
      howManyPlaceholder: "20",
      anyAmount: "Beliebige Menge — wir können sie immer gebrauchen",
      maxPerMatch: "Max. pro Match",
      maxPerMatchPlaceholder: "z. B. 20",
      maxPerMatchHint: "Optionaler Deckel, damit nicht ein Unternehmen alles auf einmal abdeckt.",
      whenNeeded: "Wann brauchst du es?",
      urgencyAsap: "So bald wie möglich",
      urgencyFlexible: "Sobald etwas verfügbar ist",
      urgencyByDate: "Bis zu einem bestimmten Datum",
      urgencyOngoing: "Laufend — wir können sie immer gebrauchen",
      neededByDateAria: "Benötigt bis Datum",
      peopleReached: "Erreichte Menschen",
      peopleReachedPlaceholder: "180",
      targetGroup: "Zielgruppe",
      targetGroupPlaceholder: "z. B. Abendkursteilnehmer:innen 16–25",
      deliveryPreference: "Lieferpräferenz",
      deliveryCollect: "Wir holen ab",
      deliveryShip: "Bitte zu uns liefern",
      deliveryEither: "Beides möglich",
      deliveryAddress: "Lieferadresse",
      deliveryAddressPlaceholder: "Straße, Gebäude, Tür — darf von der Registeradresse abweichen",
      deliveryAddressHint: "Stadt und Land oben sind der Ort; diese Zeile ist die Übergabestelle.",
      hasVehicle: "Wir haben ein Fahrzeug für die Abholung",
      story: "Warum das wichtig ist — wer profitiert?",
      storyPlaceholder:
        "Sei konkret: wer sie nutzt, wofür, wie viele Menschen erreicht werden. Genau das bringt ein Unternehmen dazu, euren Bedarf zu wählen.",
      words: "Wörter",
      atLeast: "Mindestens",
      wordsShort: "Wörter",
      soFar: "bisher.",
      submit: "Bedarf melden",
      submitPending: "Wird gemeldet…",
      errQuantityPositive: "Wenn du eine Zahl angibst, muss sie positiv sein.",
      errBeneficiariesNonNegative: "Die Zahl der Begünstigten muss null oder mehr betragen.",
      errMaxPerMatchPositive: "Max. pro Match muss eine positive ganze Zahl sein.",
      posted: "Bedarf gemeldet — Arbeitsbereich wird aktualisiert…"
    }
  }
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, de };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
