const select = (selector, root = document) => root.querySelector(selector);
const selectAll = (selector, root = document) => [...root.querySelectorAll(selector)];

function setText(selector, value) {
  const element = select(selector);
  if (element) {
    element.textContent = value ?? "";
  }
}

function setStatus(element, message, tone = "") {
  element.textContent = message;
  if (tone) {
    element.dataset.tone = tone;
  } else {
    delete element.dataset.tone;
  }
}

function currencySymbol(currency) {
  return (
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);
}

function applyConfig(config) {
  document.title = config.campaign.title;
  document.documentElement.style.setProperty("--purple", config.brand.primaryColor);
  document.documentElement.style.setProperty("--mint", config.brand.accentColor);

  setText("[data-eyebrow]", config.campaign.eyebrow);
  setText("[data-headline]", config.campaign.headline);
  setText("[data-summary]", config.campaign.summary);
  setText("[data-target]", config.campaign.target);
  setText("[data-demand]", config.campaign.demand);
  setText("[data-why-now]", config.campaign.whyNow);
  setText("[data-success-title]", config.action.successTitle);
  setText("[data-success-message]", config.action.successMessage);
  setText("[data-donation-heading]", config.donation.heading);
  setText("[data-donation-message]", config.donation.message);

  selectAll("[data-action-label]").forEach((element) => {
    element.textContent = config.action.ctaLabel;
  });
  select("[data-petition-submit]").textContent = config.action.ctaLabel;

  selectAll("[data-logo]").forEach((image) => {
    image.src = config.brand.logoPath;
    image.alt = config.brand.organisationName;
  });
  selectAll("[data-privacy-link]").forEach((link) => {
    link.href = config.legal.privacyUrl;
  });
  setText("[data-consent-label]", config.legal.consentLabel);

  const proofList = select("[data-proof-list]");
  proofList.replaceChildren(
    ...config.campaign.proofPoints.map((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      return item;
    })
  );

  const sourceLink = select("[data-source-link]");
  if (config.campaign.sourceUrl) {
    sourceLink.href = config.campaign.sourceUrl;
    sourceLink.textContent = config.campaign.sourceLabel;
    sourceLink.hidden = false;
  }
}

function setupShare(config) {
  const campaignURL = config.campaign.publicUrl || window.location.href.split("#")[0];
  const message = `${config.share.message}${config.share.hashtag ? ` #${config.share.hashtag}` : ""}`;
  const encodedURL = encodeURIComponent(campaignURL);
  const fullMessage = encodeURIComponent(`${message} ${campaignURL}`);

  select("[data-share-facebook]").href =
    `https://www.facebook.com/sharer/sharer.php?u=${encodedURL}`;
  select("[data-share-whatsapp]").href = `https://wa.me/?text=${fullMessage}`;
  select("[data-share-bluesky]").href =
    `https://bsky.app/intent/compose?text=${fullMessage}`;
  select("[data-share-email]").href =
    `mailto:?subject=${encodeURIComponent(config.campaign.title)}&body=${fullMessage}`;

  const status = select("#share-status");
  const nativeButton = select("[data-share-native]");
  if (!navigator.share) {
    nativeButton.hidden = true;
  } else {
    nativeButton.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: config.campaign.title,
          text: message,
          url: campaignURL
        });
        setStatus(status, "Thanks for sharing.", "success");
      } catch (error) {
        if (error?.name !== "AbortError") {
          setStatus(status, "Sharing was not available. Try copying the link.", "error");
        }
      }
    });
  }

  select("[data-share-copy]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(campaignURL);
      setStatus(status, "Campaign link copied.", "success");
    } catch {
      setStatus(status, campaignURL);
    }
  });
}

function setupPetition(config, supporter) {
  const form = select("#petition-form");
  const submit = select("[data-petition-submit]");
  const status = select("#petition-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      country: String(data.get("country") ?? "").trim(),
      consent: data.get("consent") === "on",
      source: "campaign-microsite"
    };

    submit.disabled = true;
    setStatus(status, config.demoMode ? "Saving this demo action…" : "Adding your name…");
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || "We could not add your name");
      }
      Object.assign(supporter, payload);
      form.reset();
      setStatus(
        status,
        config.demoMode
          ? "Demo action complete. No supporter data was stored."
          : "Your name has been added.",
        "success"
      );
      const postAction = select("#post-action");
      postAction.hidden = false;
      postAction.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus(status, error.message || "Please try again.", "error");
    } finally {
      submit.disabled = false;
    }
  });
}

function waitForBraintree(timeout = 10_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (
        window.braintree?.client &&
        window.braintree?.hostedFields &&
        window.braintree?.threeDSecure &&
        window.braintree?.dataCollector
      ) {
        resolve(window.braintree);
        return;
      }
      if (Date.now() - started >= timeout) {
        reject(new Error("Secure payment fields did not load"));
        return;
      }
      window.setTimeout(check, 80);
    };
    check();
  });
}

function createBraintreeClient(braintree, authorization) {
  return new Promise((resolve, reject) => {
    braintree.client.create({ authorization }, (error, client) => {
      if (error) reject(error);
      else resolve(client);
    });
  });
}

function createHostedFields(braintree, client) {
  return new Promise((resolve, reject) => {
    braintree.hostedFields.create(
      {
        client,
        styles: {
          input: {
            color: "#101820",
            "font-family": "Arial, sans-serif",
            "font-size": "16px"
          },
          ":focus": { color: "#101820" },
          ".invalid": { color: "#b0131d" }
        },
        fields: {
          number: {
            selector: "#braintree-card-number",
            placeholder: "4111 1111 1111 1111"
          },
          expirationDate: {
            selector: "#braintree-expiration-date",
            placeholder: "MM / YY"
          },
          cvv: {
            selector: "#braintree-cvv",
            placeholder: "123"
          }
        }
      },
      (error, fields) => {
        if (error) reject(error);
        else resolve(fields);
      }
    );
  });
}

function createThreeDSecure(braintree, client) {
  return new Promise((resolve, reject) => {
    braintree.threeDSecure.create({ client, version: 2 }, (error, instance) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
}

function createDataCollector(braintree, client) {
  return new Promise((resolve, reject) => {
    braintree.dataCollector.create({ client, paypal: false }, (error, instance) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
}

function tokenize(fields) {
  return new Promise((resolve, reject) => {
    fields.tokenize({ vault: false }, (error, payload) => {
      if (error) reject(error);
      else resolve(payload);
    });
  });
}

async function initializeTurnstile(config, state) {
  if (!config.turnstile.siteKey) {
    return;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Security check did not load")), {
      once: true
    });
    document.head.append(script);
  });
  window.turnstile.render("#turnstile-container", {
    sitekey: config.turnstile.siteKey,
    callback(token) {
      state.turnstileToken = token;
    },
    "expired-callback"() {
      state.turnstileToken = "";
    }
  });
}

async function setupDonation(config, supporter) {
  const panel = select(".donation-panel");
  if (!config.donation.enabled) {
    panel.hidden = true;
    return;
  }

  const form = select("#donation-form");
  const submit = select("[data-donation-submit]");
  const status = select("#donation-status");
  const securePayment = select("[data-secure-payment]");
  const currency = config.donation.currency;
  const state = {
    amount: config.donation.defaultAmount,
    hostedFields: null,
    threeDSecure: null,
    deviceData: "",
    turnstileToken: ""
  };

  select("[data-currency-symbol]").textContent = currencySymbol(currency);
  const customAmount = select("#custom-amount");
  customAmount.min = String(config.donation.minimumAmount);
  customAmount.max = String(config.donation.maximumAmount);
  customAmount.placeholder = String(config.donation.defaultAmount);

  const amountGrid = select("[data-amount-grid]");
  const amountButtons = config.donation.amounts.map((amount) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "amount-button";
    button.textContent = formatMoney(amount, currency);
    button.dataset.amount = String(amount);
    button.setAttribute("aria-pressed", String(amount === state.amount));
    button.addEventListener("click", () => {
      state.amount = amount;
      customAmount.value = "";
      amountButtons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
    });
    return button;
  });
  amountGrid.replaceChildren(...amountButtons);

  customAmount.addEventListener("input", () => {
    const amount = Number(customAmount.value);
    if (Number.isFinite(amount) && amount > 0) {
      state.amount = amount;
      amountButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
    }
  });

  if (!config.donation.monthlyEnabled) {
    select("[data-monthly-option]").hidden = true;
  }

  if (config.demoMode) {
    securePayment.hidden = true;
    select(".vault-option").hidden = true;
    submit.textContent = "Complete demo donation";
  } else {
    try {
      setStatus(status, "Loading secure payment fields…");
      const tokenResponse = await fetch(
        `/api/braintree/token?currency=${encodeURIComponent(currency)}`
      );
      const tokenResult = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenResult.token) {
        throw new Error(tokenResult.error || "Could not load secure payment fields");
      }
      const braintree = await waitForBraintree();
      const client = await createBraintreeClient(braintree, tokenResult.token);
      const [hostedFields, threeDSecure, dataCollector] = await Promise.all([
        createHostedFields(braintree, client),
        createThreeDSecure(braintree, client),
        createDataCollector(braintree, client)
      ]);
      state.hostedFields = hostedFields;
      state.threeDSecure = threeDSecure;
      state.deviceData = dataCollector.deviceData || "";
      await initializeTurnstile(config, state);
      setStatus(status, "");
    } catch (error) {
      submit.disabled = true;
      setStatus(status, error.message || "Secure payment fields are unavailable.", "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = Number(state.amount);
    if (
      !Number.isFinite(amount) ||
      amount < config.donation.minimumAmount ||
      amount > config.donation.maximumAmount
    ) {
      setStatus(
        status,
        `Choose an amount between ${formatMoney(
          config.donation.minimumAmount,
          currency
        )} and ${formatMoney(config.donation.maximumAmount, currency)}.`,
        "error"
      );
      return;
    }
    if (!supporter.email) {
      setStatus(status, "Please sign the petition before donating.", "error");
      return;
    }
    if (config.turnstile.required && !state.turnstileToken) {
      setStatus(status, "Please complete the security check.", "error");
      return;
    }

    submit.disabled = true;
    setStatus(status, config.demoMode ? "Completing demo donation…" : "Processing securely…");
    try {
      let payment = {};
      if (!config.demoMode) {
        if (!state.hostedFields) {
          throw new Error("Secure payment fields are not ready");
        }
        const tokenized = await tokenize(state.hostedFields);
        payment = tokenized;
        if (state.threeDSecure) {
          const nameParts = supporter.name.trim().split(/\s+/);
          const country = supporter.country.trim().toUpperCase();
          const verified = await state.threeDSecure.verifyCard({
            nonce: tokenized.nonce,
            bin: tokenized.details?.bin,
            amount: amount.toFixed(2),
            challengeRequested: true,
            email: supporter.email,
            billingAddress: {
              givenName: nameParts[0] || undefined,
              surname: nameParts.slice(1).join(" ") || undefined,
              countryCodeAlpha2: /^[A-Z]{2}$/.test(country) ? country : undefined
            }
          });
          if (
            verified.threeDSecureInfo?.liabilityShiftPossible &&
            !verified.threeDSecureInfo?.liabilityShifted
          ) {
            throw new Error("Card verification was not completed");
          }
          payment = verified;
        }
      }

      const recurring =
        new FormData(form).get("frequency") === "monthly" &&
        config.donation.monthlyEnabled;
      const response = await fetch("/api/braintree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          recurring,
          vault: select("#store-in-vault").checked,
          member: {
            name: supporter.name,
            email: supporter.email,
            country: supporter.country
          },
          nonce: payment.nonce,
          authenticationId:
            payment.threeDSecureInfo?.threeDSecureAuthenticationId || undefined,
          deviceData: state.deviceData,
          turnstileToken: state.turnstileToken,
          correlationId: crypto.randomUUID()
        })
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || "The donation could not be completed");
      }
      form.hidden = true;
      select("[data-donation-success]").hidden = false;
    } catch (error) {
      setStatus(status, error.message || "Please check your details and try again.", "error");
      if (window.turnstile) {
        window.turnstile.reset();
        state.turnstileToken = "";
      }
    } finally {
      submit.disabled = false;
    }
  });
}

async function main() {
  const response = await fetch("/api/site-config");
  if (!response.ok) {
    throw new Error("Campaign configuration could not be loaded");
  }
  const config = await response.json();
  applyConfig(config);
  setupShare(config);
  const supporter = { name: "", email: "", country: "" };
  setupPetition(config, supporter);
  await setupDonation(config, supporter);
}

main().catch((error) => {
  console.error(error);
  const status = select("#petition-status");
  if (status) {
    setStatus(status, "This campaign page is temporarily unavailable.", "error");
  }
});
