import { publishOverlayStatus } from './overlay';
import {
  buildCodCheckoutSnapshot,
  hasCodEvidence,
  isCodUnavailable,
} from './cod';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const DEVICE_UDID = process.env.ANDROID_DEVICE_UDID ?? '55221VDAQ000J1';
const BLINKIT_PACKAGE = 'com.grofers.customerapp';

type AppiumResponse<T> = {
  value: T;
};

type AppiumElement = {
  'element-6066-11e4-a52e-4f735466cecf'?: string;
  ELEMENT?: string;
};

const appiumGlobal = globalThis as typeof globalThis & {
  errandosBlinkitSessionId?: string;
  errandosCodFinalAttempts?: Set<string>;
};
let blinkitSessionId = appiumGlobal.errandosBlinkitSessionId;
const codFinalAttempts =
  appiumGlobal.errandosCodFinalAttempts ?? new Set<string>();
appiumGlobal.errandosCodFinalAttempts = codFinalAttempts;

async function appiumRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${APPIUM_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await response.json() as AppiumResponse<T> & {
    value?: { error?: string; message?: string };
  };

  if (!response.ok || payload.value?.error) {
    throw new Error(payload.value?.message ?? `Appium request failed with ${response.status}.`);
  }

  return payload.value as T;
}

function elementId(element: AppiumElement): string {
  const id = element['element-6066-11e4-a52e-4f735466cecf'] ?? element.ELEMENT;
  if (!id) throw new Error('Appium did not return an element ID.');
  return id;
}

async function findElement(
  sessionId: string,
  using: 'id' | 'xpath',
  value: string,
  parentElementId?: string,
): Promise<string | undefined> {
  const parentPath = parentElementId ? `/element/${parentElementId}` : '';
  try {
    const element = await appiumRequest<AppiumElement>(
      `/session/${sessionId}${parentPath}/element`,
      {
        body: JSON.stringify({ using, value }),
        method: 'POST',
      },
    );
    return elementId(element);
  } catch {
    return undefined;
  }
}

async function findElements(
  sessionId: string,
  using: 'id' | 'xpath',
  value: string,
): Promise<string[]> {
  try {
    const elements = await appiumRequest<AppiumElement[]>(
      `/session/${sessionId}/elements`,
      {
        body: JSON.stringify({ using, value }),
        method: 'POST',
      },
    );
    return elements.map(elementId);
  } catch {
    return [];
  }
}

async function pageSource(sessionId: string): Promise<string> {
  return appiumRequest<string>(`/session/${sessionId}/source`);
}

async function findClickableByExactLabels(
  sessionId: string,
  labels: string[],
): Promise<string[]> {
  const conditions = labels
    .flatMap((label) => [`@text="${label}"`, `@content-desc="${label}"`])
    .join(' or ');
  const matches = await findElements(
    sessionId,
    'xpath',
    `//*[( ${conditions} )]/ancestor-or-self::*[@clickable="true"][1]`,
  );
  const uniqueByBounds = new Map<string, string>();
  for (const id of [...new Set(matches)]) {
    const bounds = await elementAttribute(sessionId, id, 'bounds');
    uniqueByBounds.set(bounds || id, id);
  }
  return [...uniqueByBounds.values()];
}

async function waitForElement(
  sessionId: string,
  using: 'id' | 'xpath',
  value: string,
  parentElementId?: string,
): Promise<string | undefined> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const found = await findElement(sessionId, using, value, parentElementId);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return undefined;
}

async function clickElement(sessionId: string, id: string): Promise<void> {
  await appiumRequest(`/session/${sessionId}/element/${id}/click`, {
    body: '{}',
    method: 'POST',
  });
}

async function clearElement(sessionId: string, id: string): Promise<void> {
  await appiumRequest(`/session/${sessionId}/element/${id}/clear`, {
    body: '{}',
    method: 'POST',
  });
}

async function typeIntoElement(sessionId: string, id: string, text: string): Promise<void> {
  await appiumRequest(`/session/${sessionId}/element/${id}/value`, {
    body: JSON.stringify({ text }),
    method: 'POST',
  });
}

async function navigateBack(sessionId: string): Promise<void> {
  await appiumRequest(`/session/${sessionId}/back`, {
    body: '{}',
    method: 'POST',
  });
}

async function currentAppPackage(sessionId: string): Promise<string | undefined> {
  try {
    return await appiumRequest<string>(
      `/session/${sessionId}/appium/device/current_package`,
    );
  } catch {
    return undefined;
  }
}

async function activateBlinkitApp(sessionId: string): Promise<void> {
  await appiumRequest(`/session/${sessionId}/execute/sync`, {
    body: JSON.stringify({
      args: [{ appId: BLINKIT_PACKAGE }],
      script: 'mobile: activateApp',
    }),
    method: 'POST',
  });
}

async function elementAttribute(
  sessionId: string,
  id: string,
  name: string,
): Promise<string | undefined> {
  try {
    return await appiumRequest<string>(`/session/${sessionId}/element/${id}/attribute/${name}`);
  } catch {
    return undefined;
  }
}

function productTokens(value: string): string[] {
  const stopWords = new Set([
    'add', 'cart', 'please', 'to', 'my', 'the', 'a', 'an', 'of',
    'mujhe', 'chahiye', 'kar', 'do', 'ka', 'ki', 'ke', 'packet', 'pack',
  ]);

  return value
    .toLocaleLowerCase('en-IN')
    .replace(/\blay['’]?s\b|\blayers\b/g, 'lays')
    .replace(/\bdoodh\b|\bdudh\b/g, 'milk')
    .replace(/\btaza\b|\btazaa\b/g, 'taaza')
    .replace(/\bgrams?\b/g, 'g')
    .replace(/\bkilograms?\b|\bkgs?\b/g, 'kg')
    .replace(/\bmillilit(?:er|re)s?\b|\bmls?\b/g, 'ml')
    .replace(/\blitres?\b|\bliters?\b/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token));
}

function searchQueryFor(request: string): string {
  return request
    .replace(/\blayers\b/gi, 'Lays')
    .replace(/\blay['’]?s\b/gi, 'Lays');
}

function matchesRequestedProduct(request: string, product: string, size?: string): boolean {
  const requested = productTokens(request);
  const available = new Set(productTokens(`${product} ${size ?? ''}`));
  return requested.length > 0 && requested.every((token) => available.has(token));
}

function hasExactProductIntent(request: string, size?: string): boolean {
  const requested = new Set(productTokens(request));
  if (requested.size < 2) return false;

  const sizeTokens = productTokens(size ?? '');
  return sizeTokens.length === 0 || sizeTokens.every((token) => requested.has(token));
}

export async function readPhoneStatus() {
  const status = await appiumRequest<Record<string, unknown>>('/status');
  return {
    appium: 'ready',
    device: DEVICE_UDID,
    details: status,
  };
}

async function createBlinkitSession(): Promise<string> {
  const value = await appiumRequest<{ sessionId?: string } | Record<string, unknown>>('/session', {
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          platformName: 'Android',
          'appium:automationName': 'UiAutomator2',
          'appium:appPackage': BLINKIT_PACKAGE,
          'appium:appWaitActivity': '*',
          'appium:autoLaunch': true,
          'appium:newCommandTimeout': 180,
          'appium:noReset': true,
          'appium:udid': DEVICE_UDID,
        },
        firstMatch: [{}],
      },
    }),
    method: 'POST',
  });

  const sessionId =
    'sessionId' in value && typeof value.sessionId === 'string'
      ? value.sessionId
      : undefined;
  if (!sessionId) {
    throw new Error('Appium did not return a session ID.');
  }

  blinkitSessionId = sessionId;
  appiumGlobal.errandosBlinkitSessionId = sessionId;
  return sessionId;
}

async function activeBlinkitSession(): Promise<string> {
  const sessionId = blinkitSessionId ?? await createBlinkitSession();

  try {
    await activateBlinkitApp(sessionId);
  } catch {
    blinkitSessionId = undefined;
    appiumGlobal.errandosBlinkitSessionId = undefined;
    return createBlinkitSession();
  }

  return sessionId;
}

export async function openBlinkit() {
  await activeBlinkitSession();

  return {
    action: 'open_blinkit',
    app: 'Blinkit',
    device: DEVICE_UDID,
    ok: true,
  };
}

export async function prepareGrocery(request: string, requestedSearchQuery?: string) {
  const query = request.trim();
  if (!query) throw new Error('A grocery product is required.');
  const searchQuery = searchQueryFor(requestedSearchQuery?.trim() || query);

  await publishOverlayStatus(`Searching for ${searchQuery}`, 'searching');
  const sessionId = await activeBlinkitSession();
  await new Promise((resolve) => setTimeout(resolve, 700));
  let searchInput: string | undefined;
  for (let screenAttempt = 0; screenAttempt < 5 && !searchInput; screenAttempt += 1) {
    searchInput = await findElement(
      sessionId,
      'id',
      `${BLINKIT_PACKAGE}:id/edittext`,
    );

    if (!searchInput) {
      const searchBar = await findElement(
        sessionId,
        'id',
        `${BLINKIT_PACKAGE}:id/z_search_bar`,
      );
      if (searchBar) {
        await clickElement(sessionId, searchBar);
        searchInput = await waitForElement(
          sessionId,
          'id',
          `${BLINKIT_PACKAGE}:id/edittext`,
        );
      }
    }

    if (!searchInput && screenAttempt < 4) {
      const activePackage = await currentAppPackage(sessionId);
      if (activePackage !== BLINKIT_PACKAGE) {
        await publishOverlayStatus('Reopening Blinkit', 'working');
        await activateBlinkitApp(sessionId);
      } else {
        await publishOverlayStatus('Returning to Blinkit search', 'working');
        await navigateBack(sessionId);
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  if (!searchInput) throw new Error('Blinkit search is not available after returning to Home.');
  await clearElement(sessionId, searchInput);
  await typeIntoElement(sessionId, searchInput, searchQuery);
  await publishOverlayStatus('Checking the options on screen', 'working');

  let productCards: string[] = [];
  for (let attempt = 0; attempt < 10 && productCards.length === 0; attempt += 1) {
    productCards = await findElements(
      sessionId,
      'xpath',
      '//android.view.ViewGroup[contains(@content-desc, "is available for")]',
    );
    if (productCards.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  if (productCards.length === 0) {
    await publishOverlayStatus(`I couldn't find ${searchQuery}`, 'clarification');
    return {
      ok: false,
      status: 'not_found',
      request: query,
      message: `Blinkit did not return a product for “${query}”.`,
    };
  }

  const uniqueCandidates = new Map<string, {
    cardId: string;
    product: string;
    price?: string;
    size?: string;
  }>();

  for (const cardId of productCards.slice(0, 10)) {
    const cardDescription = await elementAttribute(sessionId, cardId, 'content-desc') ?? '';
    const [product, price] = cardDescription.split(' is available for ');
    if (!product) continue;

    const sizeElement = await findElement(
      sessionId,
      'id',
      `${BLINKIT_PACKAGE}:id/tv_uom_title`,
      cardId,
    );
    const size = sizeElement
      ? await elementAttribute(sessionId, sizeElement, 'content-desc')
      : undefined;
    const key = `${product}|${size ?? ''}|${price ?? ''}`;
    if (!uniqueCandidates.has(key)) {
      uniqueCandidates.set(key, { cardId, product, price, size });
    }
  }

  const matchingCandidates = [...uniqueCandidates.values()].filter((candidate) =>
    matchesRequestedProduct(query, candidate.product, candidate.size));
  const exactMatches = matchingCandidates.filter((candidate) =>
    hasExactProductIntent(query, candidate.size));

  if (exactMatches.length !== 1) {
    const options = (
      matchingCandidates.length > 0
        ? matchingCandidates
        : [...uniqueCandidates.values()]
    )
      .slice(0, 5)
      .map(({ product, size, price }) => ({ product, size, price }));

    const optionSummary = options
      .slice(0, 3)
      .map((option) => `${option.product}${option.size ? ` ${option.size}` : ''}`)
      .join(', ');
    await publishOverlayStatus(
      `Which one do you want? ${optionSummary}`,
      'clarification',
    );

    return {
      ok: false,
      status: 'needs_clarification',
      request: query,
      options,
      message: matchingCandidates.length > 0
        ? `I found multiple matching products. Ask the user to choose the exact product and size shown on screen.`
        : `I could not uniquely match “${query}”. Ask the user which visible product and size they want.`,
    };
  }

  const { cardId: productCard, product, price, size } = exactMatches[0]!;

  const existingQuantity = await findElement(
    sessionId,
    'xpath',
    './/*[starts-with(@content-desc, "quantity ")]',
    productCard,
  );
  if (existingQuantity) {
    const quantity = await elementAttribute(sessionId, existingQuantity, 'content-desc');
    await publishOverlayStatus(
      `${product}${size ? ` · ${size}` : ''} is already in your cart.`,
      'success',
    );
    return {
      ok: true,
      status: 'already_in_cart',
      request: query,
      product,
      size,
      price,
      quantity,
      message: `${product}${size ? ` ${size}` : ''} is already in the cart.`,
    };
  }

  const addButton = await waitForElement(
    sessionId,
    'xpath',
    './/*[@content-desc="ADD"]',
    productCard,
  );
  if (!addButton) throw new Error(`The ADD control for ${product} is not available.`);
  await publishOverlayStatus(`Adding ${product}`, 'adding');
  await clickElement(sessionId, addButton);
  await publishOverlayStatus('Confirming the cart', 'working');

  const quantityElement = await waitForElement(
    sessionId,
    'xpath',
    './/*[starts-with(@content-desc, "quantity ")]',
    productCard,
  );
  const quantity = quantityElement
    ? await elementAttribute(sessionId, quantityElement, 'content-desc')
    : 'quantity 1';

  await publishOverlayStatus(
    `${product}${size ? ` · ${size}` : ''} added to your cart.`,
    'success',
  );

  return {
    ok: true,
    status: 'added',
    request: query,
    product,
    size,
    price,
    quantity,
    message: `Added ${product}${size ? ` ${size}` : ''} to the cart at ${price ?? 'the displayed price'}.`,
  };
}

export async function prepareCodCheckout() {
  await publishOverlayStatus('Opening your cart for COD review', 'checkout');
  const sessionId = await activeBlinkitSession();
  await new Promise((resolve) => setTimeout(resolve, 700));

  let checkoutSource = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const source = await pageSource(sessionId);
    if (source.includes('package="com.android.systemui"')) {
      return {
        ok: false,
        status: 'device_locked',
        message: 'The phone is locked. Unlock it, then ask me to prepare the COD checkout again.',
      };
    }
    if (
      /place order|pay using|select payment option|delivering to/i.test(source)
    ) {
      checkoutSource = source;
      break;
    }

    const cartTargets = await findClickableByExactLabels(
      sessionId,
      ['View cart', 'Go to cart'],
    );
    if (cartTargets.length > 1) {
      throw new Error('Blinkit returned multiple cart controls.');
    }
    if (cartTargets.length === 1) {
      await clickElement(sessionId, cartTargets[0]!);
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      continue;
    }

    const activePackage = await currentAppPackage(sessionId);
    if (activePackage !== BLINKIT_PACKAGE) await activateBlinkitApp(sessionId);
    else await navigateBack(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  if (!checkoutSource) {
    return {
      ok: false,
      status: 'cart_unavailable',
      message: 'I could not open a checkout-ready Blinkit cart.',
    };
  }
  if (isCodUnavailable(checkoutSource)) {
    return {
      ok: false,
      status: 'cod_unavailable',
      message: 'Cash on Delivery is not available for this cart.',
    };
  }

  const reviewSources = [checkoutSource];
  if (!hasCodEvidence(checkoutSource)) {
    const paymentTargets = await findClickableByExactLabels(
      sessionId,
      ['PAY USING', 'Select payment option'],
    );
    if (paymentTargets.length !== 1) {
      return {
        ok: false,
        status: 'cod_unavailable',
        message: 'I could not open a unique payment selector for this cart.',
      };
    }

    await publishOverlayStatus('Checking Cash on Delivery availability', 'checkout');
    await clickElement(sessionId, paymentTargets[0]!);
    await new Promise((resolve) => setTimeout(resolve, 800));
    let paymentSource = await pageSource(sessionId);
    reviewSources.push(paymentSource);
    if (isCodUnavailable(paymentSource)) {
      return {
        ok: false,
        status: 'cod_unavailable',
        message: 'Cash on Delivery is not available for this cart.',
      };
    }

    const codTargets = await findClickableByExactLabels(
      sessionId,
      ['Cash on Delivery', 'Pay On Delivery'],
    );
    if (codTargets.length !== 1) {
      return {
        ok: false,
        status: 'cod_unavailable',
        message: 'Blinkit did not show one selectable Cash on Delivery option.',
      };
    }

    await clickElement(sessionId, codTargets[0]!);
    await new Promise((resolve) => setTimeout(resolve, 900));
    paymentSource = await pageSource(sessionId);
    reviewSources.push(paymentSource);
  }

  let snapshot = buildCodCheckoutSnapshot(reviewSources.join('\n'));
  if (!snapshot) {
    await navigateBack(sessionId).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 700));
    reviewSources.push(await pageSource(sessionId));
    snapshot = buildCodCheckoutSnapshot(reviewSources.join('\n'));
  }
  if (!snapshot) {
    return {
      ok: false,
      status: 'checkout_unverified',
      message: 'COD was visible, but I could not verify the cart total and saved address.',
    };
  }

  await publishOverlayStatus('COD cart ready for your confirmation', 'confirmation');
  return {
    ok: false,
    status: 'confirmation_required',
    checkout: snapshot,
    confirmationPhrase: 'Confirm COD order',
    message: [
      `COD checkout is ready for ₹${snapshot.total}`,
      `to ${snapshot.addressLabel}.`,
      'Say “Confirm COD order” to place it.',
    ].join(' '),
  };
}

export async function placeCodOrder(expectedFingerprint: string) {
  const sessionId = await activeBlinkitSession();
  const source = await pageSource(sessionId);
  const snapshot = buildCodCheckoutSnapshot(source);
  if (!snapshot || snapshot.fingerprint !== expectedFingerprint) {
    return {
      ok: false,
      status: 'checkout_changed',
      message: 'The checkout terms changed. I did not place the order; review it again.',
    };
  }
  if (codFinalAttempts.has(expectedFingerprint)) {
    return {
      ok: false,
      status: 'order_attempt_already_made',
      message: 'A final order attempt was already made for these terms. Check Blinkit before retrying.',
    };
  }

  const placeOrderTargets = await findClickableByExactLabels(
    sessionId,
    ['Place Order'],
  );
  if (placeOrderTargets.length !== 1) {
    return {
      ok: false,
      status: 'final_action_unavailable',
      message: 'I could not verify one final Place Order control, so I stopped.',
    };
  }

  codFinalAttempts.add(expectedFingerprint);
  await publishOverlayStatus('Placing the confirmed COD order', 'adding');
  await clickElement(sessionId, placeOrderTargets[0]!);
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  const confirmationSource = await pageSource(sessionId);
  const providerReference =
    /(?:order\s*(?:id|number|#)\s*[:#-]?\s*)([A-Za-z0-9-]{4,100})/i
      .exec(confirmationSource)?.[1];
  if (
    /order is confirmed|track order/i.test(confirmationSource)
      && providerReference
  ) {
    await publishOverlayStatus('COD order confirmed', 'success');
    return {
      ok: true,
      status: 'ordered',
      providerReference,
      message: `The COD order is confirmed. Reference ${providerReference}.`,
    };
  }

  await publishOverlayStatus('Check Blinkit for the final order status', 'error');
  return {
    ok: false,
    status: 'order_status_ambiguous',
    message: 'The final button was pressed once, but the provider reference was not verified. Check Blinkit before doing anything else.',
  };
}
