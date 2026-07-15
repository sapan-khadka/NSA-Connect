/**
 * Manual E2E walkthrough of Member Workspace (not a vitest unit test).
 * Run: node scripts/member-workspace-walkthrough.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../walkthrough-artifacts");
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.WALKTHROUGH_BASE_URL ?? "http://127.0.0.1:5173";
const PASSWORD = "WalkthroughPass123!";
const IDS = {
  officerEmail: "mukesh@semo.edu",
  generalEmail: "walkthrough-general@semo.edu",
  richId: 21,
  emptyId: 22,
  generalId: 23,
};

const SECTIONS_EXPECTED = [
  "Current Responsibilities",
  "Upcoming Schedule",
  "Recent Activity",
  "Financial Status",
  "Notes", // product calls this Private Notes; UI title is "Notes"
  "Documents",
  "AI Insights",
];

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 20000,
    }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
}

async function openWorkspace(page, memberId) {
  await page.goto(`${BASE}/members/${memberId}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[aria-label="Member workspace"]', {
    timeout: 20000,
  });
}

function collectSections(page) {
  return page.evaluate(() => {
    const workspace = document.querySelector('[aria-label="Member workspace"]');
    if (!workspace) {
      return { found: [], missingShell: true };
    }
    const regions = [...workspace.querySelectorAll("[aria-label]")].map(
      (el) => ({
        label: el.getAttribute("aria-label"),
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || "").slice(0, 400),
        height: el.getBoundingClientRect().height,
        top: el.getBoundingClientRect().top + window.scrollY,
      }),
    );
    // Unique by label for section cards
    const byLabel = new Map();
    for (const r of regions) {
      if (!byLabel.has(r.label)) {
        byLabel.set(r.label, r);
      }
    }
    return {
      found: [...byLabel.keys()],
      regions: [...byLabel.values()],
      bodyTextHasUndefined: /undefined|null|NaN|\[object Object\]/i.test(
        workspace.innerText,
      ),
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
}

async function spacingBetween(
  page,
  labelA,
  labelB,
) {
  return page.evaluate(
    ({ a, b }) => {
      const ea = document.querySelector(`[aria-label="${a}"]`);
      const eb = document.querySelector(`[aria-label="${b}"]`);
      if (!ea || !eb) return null;
      const ra = ea.getBoundingClientRect();
      const rb = eb.getBoundingClientRect();
      // gap between bottoms/tops if stacked in same column
      return Math.round(rb.top - ra.bottom);
    },
    { a: labelA, b: labelB },
  );
}

async function runScenario(browser, name, email, memberId, expectations) {
  const consoleMessages = [];
  const pageErrors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  const result = {
    name,
    email,
    memberId,
    ok: true,
    notes: [],
    sections: {},
    console: consoleMessages,
    pageErrors,
  };

  try {
    await login(page, email);
    await openWorkspace(page, memberId);
    await page.waitForTimeout(800);
    const snap = await collectSections(page);
    result.sections = snap;
    for (const section of SECTIONS_EXPECTED) {
      if (!snap.found.includes(section)) {
        result.ok = false;
        result.notes.push(`Missing section: ${section}`);
      }
    }
    if (snap.bodyTextHasUndefined) {
      result.ok = false;
      result.notes.push("Leaked undefined/null/NaN text in workspace");
    }

    // Empty / content checks
    for (const [label, patterns] of Object.entries(expectations.contains ?? {})) {
      const region = snap.regions.find((r) => r.label === label);
      if (!region) continue;
      for (const pat of patterns) {
        const re = new RegExp(pat, "i");
        if (!re.test(region.text)) {
          result.ok = false;
          result.notes.push(`${label} missing /${pat}/ — got: ${region.text.slice(0, 160)}`);
        }
      }
    }
    for (const [label, patterns] of Object.entries(expectations.notContains ?? {})) {
      const region = snap.regions.find((r) => r.label === label);
      if (!region) continue;
      for (const pat of patterns) {
        const re = new RegExp(pat, "i");
        if (re.test(region.text)) {
          result.ok = false;
          result.notes.push(`${label} unexpectedly matches /${pat}/`);
        }
      }
    }

    // Spacing sample in main column
    result.gapResponsibilitiesToSchedule = await spacingBetween(
      page,
      "Current Responsibilities",
      "Upcoming Schedule",
    );
    result.gapScheduleToActivity = await spacingBetween(
      page,
      "Upcoming Schedule",
      "Recent Activity",
    );
    result.gapActivityToFinance = await spacingBetween(
      page,
      "Recent Activity",
      "Financial Status",
    );
    result.gapDocsToInsights = await spacingBetween(
      page,
      "Documents",
      "AI Insights",
    );

    const shot = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    result.screenshot = shot;
  } catch (err) {
    result.ok = false;
    result.notes.push(`Exception: ${err}`);
    try {
      await page.screenshot({
        path: path.join(OUT, `${name}-error.png`),
        fullPage: true,
      });
    } catch {
      /* ignore */
    }
  }

  // Filter noisy react-router future flags if present
  result.console = consoleMessages.filter(
    (m) => !/React Router Future Flag Warning/i.test(m.text),
  );
  if (result.console.some((m) => m.type === "error") || pageErrors.length) {
    result.ok = false;
    result.notes.push("Console errors/pageerrors present");
  }

  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];

results.push(
  await runScenario(
    browser,
    "01-officer-rich",
    IDS.officerEmail,
    IDS.richId,
    {
      contains: {
        Documents: ["Rich Resume"],
        "AI Insights": ["Hasn't attended the last 3 meetings|Outstanding dues|overdue responsibility|Consistently completes"],
        "Financial Status": ["Outstanding|Paid|Lifetime"],
        "Current Responsibilities": ["Book venue|No open responsibilities|Order snacks|Print flyers|Confirm DJ"],
      },
    },
  ),
);

results.push(
  await runScenario(
    browser,
    "02-officer-empty",
    IDS.officerEmail,
    IDS.emptyId,
    {
      contains: {
        Documents: ["No documents on file"],
        "AI Insights": ["No notable patterns right now"],
        "Financial Status": ["No dues on record"],
        "Recent Activity": ["No recent activity"],
        "Upcoming Schedule": ["Nothing on the schedule|No upcoming"],
        "Current Responsibilities": ["No open responsibilities|Nothing assigned"],
      },
    },
  ),
);

results.push(
  await runScenario(
    browser,
    "03-general-self",
    IDS.generalEmail,
    IDS.generalId,
    {
      contains: {
        Documents: ["My Waiver"],
        "Financial Status": ["Paid|Lifetime|No dues"],
      },
      notContains: {
        Documents: ["Rich Resume"],
      },
    },
  ),
);

results.push(
  await runScenario(
    browser,
    "04-general-other",
    IDS.generalEmail,
    IDS.richId,
    {
      contains: {
        Documents: ["unavailable|limited to board|own profile"],
      },
      notContains: {
        Documents: ["Rich Resume"],
      },
    },
  ),
);

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  results,
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

for (const r of results) {
  console.log(`\n=== ${r.name} (${r.ok ? "PASS" : "ISSUES"}) ===`);
  console.log("sections:", r.sections.found);
  console.log("gaps:", {
    resp_sched: r.gapResponsibilitiesToSchedule,
    sched_act: r.gapScheduleToActivity,
    act_fin: r.gapActivityToFinance,
    docs_ins: r.gapDocsToInsights,
  });
  console.log("notes:", r.notes);
  console.log(
    "console:",
    r.console.map((c) => `${c.type}: ${c.text}`).slice(0, 10),
  );
  console.log("pageErrors:", r.pageErrors);
  if (r.sections.regions) {
    for (const label of SECTIONS_EXPECTED) {
      const region = r.sections.regions.find((x) => x.label === label);
      if (region) {
        console.log(`-- ${label} --\n${region.text.slice(0, 220).replace(/\n+/g, " | ")}`);
      }
    }
  }
}

console.log(`\nReport written to ${path.join(OUT, "report.json")}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
