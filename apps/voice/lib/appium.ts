import { publishOverlayStatus } from './overlay';

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

let blinkitSessionId: string | undefined;

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
  return sessionId;
}

async function activeBlinkitSession(): Promise<string> {
  const sessionId = blinkitSessionId ?? await createBlinkitSession();

  try {
    await appiumRequest(`/session/${sessionId}/execute/sync`, {
      body: JSON.stringify({
        args: [{ appId: BLINKIT_PACKAGE }],
        script: 'mobile: activateApp',
      }),
      method: 'POST',
    });
  } catch {
    blinkitSessionId = undefined;
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

export async function prepareGrocery(request: string) {
  const query = request.trim();
  if (!query) throw new Error('A grocery product is required.');
  const searchQuery = searchQueryFor(query);

  await publishOverlayStatus(`Searching for ${searchQuery}`, 'searching');
  const sessionId = await activeBlinkitSession();
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
      await publishOverlayStatus('Returning to Blinkit search', 'working');
      await navigateBack(sessionId);
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

  const matches = [...uniqueCandidates.values()].filter((candidate) =>
    matchesRequestedProduct(query, candidate.product, candidate.size));

  if (matches.length !== 1) {
    const options = (matches.length > 1 ? matches : [...uniqueCandidates.values()])
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
      message: matches.length > 1
        ? `I found multiple matching products. Ask the user to choose the exact product and size shown on screen.`
        : `I could not uniquely match “${query}”. Ask the user which visible product and size they want.`,
    };
  }

  const { cardId: productCard, product, price, size } = matches[0]!;

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
