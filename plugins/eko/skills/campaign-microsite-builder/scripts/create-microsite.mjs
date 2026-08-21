#!/usr/bin/env node

import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const templateDirectory = resolve(scriptDirectory, "../assets/microsite-template");
const sitesOverlayDirectory = resolve(scriptDirectory, "../assets/sites-overlay");
const run = promisify(execFile);

function usage() {
  return [
    "Create an Ekō campaign microsite.",
    "",
    "Usage:",
    "  node create-microsite.mjs --config /absolute/config.json --output /absolute/output",
    "",
    "Options:",
    "  --target sites|node  Output target. Defaults to sites.",
    "  --sites-init-script Override the bundled OpenAI Sites initializer path.",
    "  --force   Replace the explicit output directory if it already exists.",
    "  --help    Show this message."
  ].join("\n");
}

function parseArguments(argv) {
  const result = { force: false, target: "sites" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--force") {
      result.force = true;
      continue;
    }
    if (value === "--help" || value === "-h") {
      result.help = true;
      continue;
    }
    if (
      value === "--config" ||
      value === "--output" ||
      value === "--target" ||
      value === "--sites-init-script"
    ) {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        throw new Error(`${value} requires a path`);
      }
      result[value.slice(2)] = nextValue;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${value}`);
  }
  return result;
}

async function findSitesInitScript(override) {
  if (override) {
    const candidate = resolve(override);
    if (!(await pathExists(candidate))) {
      throw new Error(`Sites initializer does not exist: ${candidate}`);
    }
    return candidate;
  }
  if (process.env.SITES_INIT_SCRIPT) {
    return findSitesInitScript(process.env.SITES_INIT_SCRIPT);
  }

  const sitesRoot = join(
    homedir(),
    ".codex",
    "plugins",
    "cache",
    "openai-bundled",
    "sites"
  );
  let versions;
  try {
    versions = await readdir(sitesRoot, { withFileTypes: true });
  } catch {
    throw new Error(
      "OpenAI Sites initializer was not found. Install/enable the bundled Sites plugin or pass --sites-init-script."
    );
  }
  const candidates = versions
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .reverse();
  for (const version of candidates) {
    const candidate = join(sitesRoot, version, "scripts", "init-site.sh");
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error(
    "OpenAI Sites initializer was not found. Install/enable the bundled Sites plugin or pass --sites-init-script."
  );
}

async function copyDirectoryContents(source, destination) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    await cp(join(source, entry.name), join(destination, entry.name), {
      recursive: entry.isDirectory(),
      force: true
    });
  }
}

async function createSitesProject(outputPath, config, args) {
  const initScript = await findSitesInitScript(args["sites-init-script"]);
  await run("bash", [initScript, outputPath], {
    maxBuffer: 10 * 1024 * 1024
  });

  await rm(join(outputPath, "app", "_sites-preview"), {
    recursive: true,
    force: true
  });
  await copyDirectoryContents(sitesOverlayDirectory, outputPath);

  const sourcePublic = join(templateDirectory, "public");
  const outputPublic = join(outputPath, "public");
  await cp(join(sourcePublic, "site.css"), join(outputPath, "app", "globals.css"), {
    force: true
  });
  await cp(join(sourcePublic, "site.js"), join(outputPublic, "site.js"), {
    force: true
  });
  await cp(join(sourcePublic, "assets"), join(outputPublic, "assets"), {
    recursive: true,
    force: true
  });

  const indexHTML = await readFile(join(sourcePublic, "index.html"), "utf8");
  const body = indexHTML.match(/<body>([\s\S]*?)<\/body>/i)?.[1]?.trim();
  if (!body) throw new Error("microsite template body could not be extracted");
  await writeFile(join(outputPublic, "page-fragment.html"), `${body}\n`, "utf8");

  const packagePath = join(outputPath, "package.json");
  const packageJSON = JSON.parse(await readFile(packagePath, "utf8"));
  packageJSON.name = `eko-${config.campaign.slug}-microsite`;
  delete packageJSON.dependencies?.["react-loading-skeleton"];
  await writeFile(packagePath, `${JSON.stringify(packageJSON, null, 2)}\n`, "utf8");
  await run("npm", ["install", "--package-lock-only", "--ignore-scripts"], {
    cwd: outputPath,
    maxBuffer: 10 * 1024 * 1024
  });
}

async function createNodeProject(outputPath, config) {
  await mkdir(outputPath, { recursive: true });
  await cp(templateDirectory, outputPath, { recursive: true });

  const packagePath = join(outputPath, "package.json");
  const packageJSON = JSON.parse(await readFile(packagePath, "utf8"));
  packageJSON.name = `eko-${config.campaign.slug}-microsite`;
  await writeFile(packagePath, `${JSON.stringify(packageJSON, null, 2)}\n`, "utf8");
}

function requireString(value, field, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} must be a non-empty string`);
    return "";
  }
  return value.trim();
}

function requirePositiveInteger(value, field, errors, demoMode) {
  if (demoMode && (value === undefined || value === null || value === 0)) {
    return 0;
  }
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${field} must be a positive integer${demoMode ? " or 0 in demo mode" : ""}`);
    return 0;
  }
  return value;
}

function normalizeConfig(rawConfig) {
  const errors = [];
  const demoMode = rawConfig.demoMode !== false;
  const campaign = rawConfig.campaign ?? {};
  const action = rawConfig.action ?? {};
  const share = rawConfig.share ?? {};
  const donation = rawConfig.donation ?? {};
  const brand = rawConfig.brand ?? {};
  const legal = rawConfig.legal ?? {};

  const slug = requireString(campaign.slug, "campaign.slug", errors)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    errors.push("campaign.slug must contain at least one letter or digit");
  }

  const proofPoints = Array.isArray(campaign.proofPoints)
    ? campaign.proofPoints
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
    : [];
  if (proofPoints.length < 1) {
    errors.push("campaign.proofPoints must contain at least one source-backed point");
  }

  const donationEnabled = donation.enabled !== false;
  const currency = String(donation.currency ?? "GBP").trim().toUpperCase();
  const merchantAccounts =
    donation.merchantAccounts && typeof donation.merchantAccounts === "object"
      ? donation.merchantAccounts
      : {};
  const amounts = Array.isArray(donation.amounts)
    ? donation.amounts.map(Number).filter((amount) => Number.isFinite(amount) && amount > 0)
    : [5, 10, 20];
  if (donationEnabled && amounts.length === 0) {
    errors.push("donation.amounts must contain at least one positive amount");
  }
  if (donationEnabled && !demoMode && !String(merchantAccounts[currency] ?? "").trim()) {
    errors.push(`donation.merchantAccounts.${currency} is required outside demo mode`);
  }

  const minimumAmount = Number(donation.minimumAmount ?? 1);
  const maximumAmount = Number(donation.maximumAmount ?? 5000);
  const defaultAmount = Number(donation.defaultAmount ?? amounts[0] ?? minimumAmount);
  if (!Number.isFinite(minimumAmount) || minimumAmount <= 0) {
    errors.push("donation.minimumAmount must be greater than zero");
  }
  if (!Number.isFinite(maximumAmount) || maximumAmount < minimumAmount) {
    errors.push("donation.maximumAmount must be greater than or equal to the minimum");
  }
  if (
    !Number.isFinite(defaultAmount) ||
    defaultAmount < minimumAmount ||
    defaultAmount > maximumAmount
  ) {
    errors.push("donation.defaultAmount must be inside the permitted range");
  }

  const privacyUrl = requireString(legal.privacyUrl, "legal.privacyUrl", errors);
  try {
    new URL(privacyUrl);
  } catch {
    errors.push("legal.privacyUrl must be an absolute URL");
  }

  const normalized = {
    campaign: {
      slug,
      title: requireString(campaign.title, "campaign.title", errors),
      eyebrow: String(campaign.eyebrow ?? "A campaign by Ekō").trim(),
      headline: requireString(campaign.headline, "campaign.headline", errors),
      summary: requireString(campaign.summary, "campaign.summary", errors),
      target: requireString(campaign.target, "campaign.target", errors),
      demand: requireString(campaign.demand, "campaign.demand", errors),
      whyNow: requireString(campaign.whyNow, "campaign.whyNow", errors),
      proofPoints,
      publicUrl: String(campaign.publicUrl ?? "").trim(),
      sourceLabel: String(campaign.sourceLabel ?? "Campaign sources").trim(),
      sourceUrl: String(campaign.sourceUrl ?? "").trim()
    },
    action: {
      pageId: requirePositiveInteger(action.pageId, "action.pageId", errors, demoMode),
      ctaLabel: String(action.ctaLabel ?? "Sign the petition").trim(),
      successTitle: String(action.successTitle ?? "Thank you for taking action").trim(),
      successMessage: String(
        action.successMessage ?? "Now help more people add their voice."
      ).trim()
    },
    share: {
      message: String(share.message ?? "I signed this petition. Will you join me?").trim(),
      hashtag: String(share.hashtag ?? "").replace(/^#/, "").trim()
    },
    donation: {
      enabled: donationEnabled,
      pageId: donationEnabled
        ? requirePositiveInteger(donation.pageId, "donation.pageId", errors, demoMode)
        : 0,
      currency,
      merchantAccounts: Object.fromEntries(
        Object.entries(merchantAccounts).map(([key, value]) => [
          key.toUpperCase(),
          String(value).trim()
        ])
      ),
      amounts,
      defaultAmount,
      minimumAmount,
      maximumAmount,
      monthlyEnabled: donation.monthlyEnabled !== false,
      heading: String(donation.heading ?? "Power the next campaign").trim(),
      message: String(
        donation.message ?? "A small gift helps Ekō keep up the pressure."
      ).trim()
    },
    brand: {
      logoPath: String(brand.logoPath ?? "/assets/eko-logo-purple.svg").trim(),
      organisationName: String(brand.organisationName ?? "Ekō").trim(),
      primaryColor: String(brand.primaryColor ?? "#6400ff").trim(),
      accentColor: String(brand.accentColor ?? "#28dc87").trim()
    },
    legal: {
      privacyUrl,
      consentLabel: String(
        legal.consentLabel ??
          "I agree to the privacy policy and consent to be contacted about this campaign."
      ).trim()
    },
    demoMode
  };

  if (errors.length > 0) {
    throw new Error(`invalid campaign config:\n- ${errors.join("\n- ")}`);
  }

  return normalized;
}

async function pathExists(pathname) {
  try {
    await stat(pathname);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function assertSafeOutputPath(outputPath) {
  const resolvedOutput = resolve(outputPath);
  const parsed = parse(resolvedOutput);
  const unsafe = new Set([parsed.root, resolve(homedir()), resolve(process.cwd())]);
  if (unsafe.has(resolvedOutput) || basename(resolvedOutput).trim() === "") {
    throw new Error(`refusing unsafe output path: ${resolvedOutput}`);
  }
  return resolvedOutput;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.config || !args.output) {
    throw new Error(`--config and --output are required\n\n${usage()}`);
  }
  if (!["sites", "node"].includes(args.target)) {
    throw new Error("--target must be either sites or node");
  }

  const configPath = resolve(args.config);
  const outputPath = assertSafeOutputPath(args.output);
  if (!isAbsolute(configPath) || !isAbsolute(outputPath)) {
    throw new Error("config and output paths must resolve to absolute paths");
  }

  const rawConfig = JSON.parse(await readFile(configPath, "utf8"));
  const config = normalizeConfig(rawConfig);

  if (await pathExists(outputPath)) {
    if (!args.force) {
      throw new Error(`output already exists: ${outputPath}; pass --force to replace it`);
    }
    await rm(outputPath, { recursive: true, force: true });
  }

  if (args.target === "sites") {
    await createSitesProject(outputPath, config, args);
  } else {
    await createNodeProject(outputPath, config);
  }
  await writeFile(
    join(outputPath, "campaign.config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        status: "created",
        output: outputPath,
        target: args.target,
        mode: config.demoMode ? "demo" : "live-integration",
        next:
          args.target === "sites"
            ? [
                `cd ${JSON.stringify(outputPath)}`,
                "npm test",
                "npm run dev",
                "configure production runtime values with OpenAI Sites, then save and deploy a version"
              ]
            : [
                `cd ${JSON.stringify(outputPath)}`,
                "cp .env.example .env",
                "npm test",
                "npm start"
              ]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
