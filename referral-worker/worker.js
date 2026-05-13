/**
 * Pussikauppa Referral — Cloudflare Worker backend.
 *
 * Listens for 2 Shopify webhooks:
 *   POST /webhook/customer-create  -> generates WELCOME-{code} 20% discount for new customer,
 *                                     stores code in customer metafield custom.referral_welcome_code.
 *   POST /webhook/order-paid       -> reads cart attribute referral_code, finds referrer customer
 *                                     by metafield, generates REWARD-{code} 20% discount for them,
 *                                     bumps referrer's metafields custom.referral.completed_count.
 *
 * Env vars (Cloudflare → Worker → Settings → Variables):
 *   SHOPIFY_SHOP         e.g. test-hrcsf4lt.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN  Admin API token from custom app (scopes: write_discounts, read/write_customers, read_orders)
 *   SHOPIFY_WEBHOOK_SECRET  Webhook signing secret from Shopify
 *   REFEREE_PCT          default 20
 *   REFERRER_PCT         default 20
 *   COUPON_EXPIRY_DAYS   default 90
 */

const API_VERSION = '2024-10';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return new Response('ok', { status: 200 });

    const raw = await request.text();
    const valid = await verifyShopifyHmac(raw, request.headers.get('X-Shopify-Hmac-Sha256'), env.SHOPIFY_WEBHOOK_SECRET);
    if (!valid) return new Response('bad signature', { status: 401 });

    const body = JSON.parse(raw);

    try {
      if (url.pathname === '/webhook/customer-create') {
        return await handleCustomerCreate(body, env);
      }
      if (url.pathname === '/webhook/order-paid') {
        return await handleOrderPaid(body, env);
      }
    } catch (e) {
      return new Response('error: ' + e.message, { status: 500 });
    }
    return new Response('unknown route', { status: 404 });
  }
};

// ─────────────────────────────────────────────
async function handleCustomerCreate(customer, env) {
  const refereePct = parseInt(env.REFEREE_PCT || '20', 10);
  const expiryDays = parseInt(env.COUPON_EXPIRY_DAYS || '90', 10);
  const shortCode = makeShortCode(customer.id);
  const code = `WELCOME-${shortCode}`;
  const endsAt = new Date(Date.now() + expiryDays * 864e5).toISOString();

  // Create one-time code, applies to all products, 20% off, restricted to no specific customer
  // (so anyone using the code gets the discount — that's how the friend uses it).
  await shopifyGraphQL(env, `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`, {
    basicCodeDiscount: {
      title: code,
      code: code,
      startsAt: new Date().toISOString(),
      endsAt: endsAt,
      customerSelection: { all: true },
      customerGets: {
        value: { percentage: refereePct / 100 },
        items: { all: true }
      },
      appliesOncePerCustomer: true,
      usageLimit: null
    }
  });

  // Store referrer's welcome code on their customer record.
  await shopifyREST(env, `customers/${customer.id}/metafields.json`, 'POST', {
    metafield: {
      namespace: 'custom',
      key: 'referral_welcome_code',
      type: 'single_line_text_field',
      value: code
    }
  });

  return new Response(JSON.stringify({ ok: true, code }), { status: 200 });
}

// ─────────────────────────────────────────────
async function handleOrderPaid(order, env) {
  const referrerPct = parseInt(env.REFERRER_PCT || '20', 10);
  const expiryDays = parseInt(env.COUPON_EXPIRY_DAYS || '90', 10);

  const attrs = order.note_attributes || [];
  const refAttr = attrs.find(a => a.name === 'referral_code');
  if (!refAttr || !refAttr.value) return new Response('no referral_code', { status: 200 });

  const refCode = String(refAttr.value).trim();
  // Decode: customer.id = (refCode - 1000) / 7
  const referrerId = (parseInt(refCode, 10) - 1000) / 7;
  if (!Number.isInteger(referrerId) || referrerId < 1) return new Response('bad ref', { status: 200 });

  // Fraud check: referee can't be the referrer.
  if (order.customer && order.customer.id === referrerId) {
    return new Response('self-referral blocked', { status: 200 });
  }

  // Generate reward code for referrer.
  const shortCode = makeShortCode(referrerId) + '-' + (order.id % 100000);
  const rewardCode = `REWARD-${shortCode}`;
  const endsAt = new Date(Date.now() + expiryDays * 864e5).toISOString();

  // Restrict reward code to the referrer customer only.
  const customerGid = `gid://shopify/Customer/${referrerId}`;
  await shopifyGraphQL(env, `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`, {
    basicCodeDiscount: {
      title: rewardCode,
      code: rewardCode,
      startsAt: new Date().toISOString(),
      endsAt: endsAt,
      customerSelection: { customers: { add: [customerGid] } },
      customerGets: {
        value: { percentage: referrerPct / 100 },
        items: { all: true }
      },
      appliesOncePerCustomer: true,
      usageLimit: 1
    }
  });

  // Bump referrer stats + store latest reward code as their notification.
  const cur = await shopifyREST(env, `customers/${referrerId}/metafields.json?namespace=custom`, 'GET');
  const findVal = (k) => {
    const m = (cur.metafields || []).find(x => x.namespace === 'custom' && x.key === k);
    return m ? parseInt(m.value, 10) || 0 : 0;
  };
  const completed = findVal('referral_completed_count') + 1;
  const rewards   = findVal('referral_reward_count') + 1;

  await Promise.all([
    shopifyREST(env, `customers/${referrerId}/metafields.json`, 'POST', {
      metafield: { namespace: 'custom', key: 'referral_completed_count', type: 'number_integer', value: String(completed) }
    }),
    shopifyREST(env, `customers/${referrerId}/metafields.json`, 'POST', {
      metafield: { namespace: 'custom', key: 'referral_reward_count', type: 'number_integer', value: String(rewards) }
    }),
    shopifyREST(env, `customers/${referrerId}/metafields.json`, 'POST', {
      metafield: { namespace: 'custom', key: 'referral_latest_reward_code', type: 'single_line_text_field', value: rewardCode }
    })
  ]);

  return new Response(JSON.stringify({ ok: true, rewardCode, referrerId }), { status: 200 });
}

// ─────────────────────────────────────────────
async function shopifyGraphQL(env, query, variables) {
  const r = await fetch(`https://${env.SHOPIFY_SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await r.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

async function shopifyREST(env, path, method, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://${env.SHOPIFY_SHOP}/admin/api/${API_VERSION}/${path}`, opts);
  if (!r.ok) throw new Error(`REST ${method} ${path} -> ${r.status}`);
  return r.json();
}

async function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!hmacHeader || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return safeEqual(expected, hmacHeader);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function makeShortCode(customerId) {
  // Same scheme as theme.js: short stable code for a customer id.
  const n = (parseInt(customerId, 10) * 7) + 1000;
  return String(n);
}
