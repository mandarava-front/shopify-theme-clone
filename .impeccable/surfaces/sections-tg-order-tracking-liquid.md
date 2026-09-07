---
version: 1
slug: "sections-tg-order-tracking-liquid"
primary_target: "sections/tg-order-tracking.liquid"
related_targets: ["assets/tg-order-tracking.css","assets/tg-order-tracking.js"]
---

# Order tracking component

Mode: Operate. The user confirmed the original left/right structure on 2026-09-07. This supersedes the earlier horizontal-form redesign. Scope: component styling and default placeholders within the existing Shopify theme.

## Direction contract

THESIS: Keep the original lookup and result structure familiar; make the input examples unambiguous.

OWN-WORLD: Existing theme fonts and color scheme, subtle card border, 12px outer corners and 8px form controls. Local color fallbacks support shops whose theme color settings are absent.

STORY: Read the introduction on the left, enter order number and checkout email on the right, then view order details and shipment activity in the existing two-column result. Preserve the original feedback dialog.

FIRST VIEWPORT: A centered 990px shell with an approximately 400px-tall card. Left: tracking icon, heading, subtitle. Right: two stacked labeled inputs and a full-width query button. Mobile stacks intro above form.

FORM: Existing structure explicitly pinned by the user; no visual-world replacement. Placeholder defaults: “e.g. 1001” and “Email used at checkout”, 14px regular text; entered values remain 16px. Keep merchant overrides, replace known old defaults.

FINISH: Verify desktop/mobile layout and placeholder contrast; record the final component rules here. Preserve automatic shopName from shop.permanent_domain and the existing API request contract.

## Verification

The rendered placeholder color has 5.41:1 contrast on the current light theme. Empty values and the exact former defaults receive the new defaults; other merchant-authored placeholder text remains unchanged. Input validation clears corrected errors during typing so the submit control stays still when the field loses focus. Browser checks use synthetic tracking responses and do not certify live API CORS.
