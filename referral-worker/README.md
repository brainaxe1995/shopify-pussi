# Pussikauppa Referral Worker

Cloudflare Worker backend for the referral program. Replaces the WP `em-referral-program` plugin's server side.

## What it does

Two webhook endpoints, called by Shopify:

| Path | Triggered by | Action |
|---|---|---|
| `POST /webhook/customer-create` | Customer signs up | Generates `WELCOME-{code}` 20% off (single-use per customer), stores on referrer's customer record as metafield `custom.referral_welcome_code`. |
| `POST /webhook/order-paid` | Friend pays | Reads order `note_attributes.referral_code`, finds referrer, generates `REWARD-{code}` 20% off restricted to that referrer, bumps `custom.referral_completed_count` + `referral_reward_count`, stores latest reward code in `custom.referral_latest_reward_code`. |

Self-referral (referrer = orderer) is rejected.

## Setup — 4 steps

### 1. Shopify custom app + Admin API token

Admin → Settings → **Apps and sales channels** → **Develop apps** → **Allow custom app development** (if not enabled).

Then **Create an app** → name `Pussikauppa Referral`.

Tab **Configuration** → **Admin API integration** → **Configure** → set scopes:
- `read_customers`, `write_customers`
- `read_discounts`, `write_discounts`
- `read_orders`

Save. Tab **API credentials** → **Install app** → copy **Admin API access token** (shown once).

### 2. Get webhook signing secret

Same app → **API credentials** → scroll to **Webhook subscriptions** section → copy **API secret key** (also shown as "Webhook signing secret").

### 3. Deploy Cloudflare Worker

```bash
# install wrangler once
npm install -g wrangler

cd referral-worker
wrangler login                                    # browser opens; auth your Cloudflare account
wrangler deploy                                   # creates pussi-referral.<account>.workers.dev

# set secrets
wrangler secret put SHOPIFY_SHOP                  # paste: test-hrcsf4lt.myshopify.com
wrangler secret put SHOPIFY_ADMIN_TOKEN           # paste: shpat_... from step 1
wrangler secret put SHOPIFY_WEBHOOK_SECRET        # paste: secret from step 2
```

Note the deployed URL, e.g. `https://pussi-referral.brainaxe1995.workers.dev`.

### 4. Register Shopify webhooks

Admin → Settings → **Notifications** → scroll to **Webhooks** → **Create webhook** × 2:

| Event | Format | URL |
|---|---|---|
| `Customer creation` | JSON | `https://pussi-referral.<account>.workers.dev/webhook/customer-create` |
| `Order payment` (`Orders/paid`) | JSON | `https://pussi-referral.<account>.workers.dev/webhook/order-paid` |

### 5. Customer metafield definitions (theme reads these on dashboard)

Admin → Settings → **Custom data** → **Customers** → **Add definition** × 4:

| Name | Namespace.key | Type |
|---|---|---|
| Welcome code | `custom.referral_welcome_code` | Single line text |
| Latest reward code | `custom.referral_latest_reward_code` | Single line text |
| Completed referrals | `custom.referral_completed_count` | Integer |
| Reward count | `custom.referral_reward_count` | Integer |

If you don't see "Customers" in the Custom data list, open any customer record, scroll to "Metafields" card, click **Show all** → **Add definition** — same form.

## Verify end-to-end

1. Sign out, sign up new test customer.
2. Within 5s Worker creates `WELCOME-{code}` discount visible in Admin → Discounts.
3. Logout → visit `/?ref={code}` with that customer's code (from /pages/referral-program dashboard).
4. Add product to cart → checkout. Discount auto-applied.
5. Pay test order. Worker creates `REWARD-{code}` for original referrer + bumps their stats.
6. Log back in as referrer → `/pages/referral-program` dashboard shows completed count = 1.

## Cost

Cloudflare Workers free tier: 100 000 requests / day, more than enough.

## Maintenance

```bash
wrangler deploy                                   # push new worker.js
wrangler tail                                     # stream logs live
```
