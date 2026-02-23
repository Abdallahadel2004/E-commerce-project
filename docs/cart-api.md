# 🛒 Cart & Checkout API

> **Base URL:** `http://localhost:3000`

---

## How It Works

```
Step 1:  Add items to your cart
Step 2:  View your cart
Step 3:  Checkout → creates an order
Step 4:  Pay with Stripe → confirms the order & deducts stock
```

---

## Authentication

- **Cart endpoints** → No login needed (works for guests & logged-in users)
- **Checkout** → Login required (send `Authorization: Bearer <token>`)
- **Payment** → Login required for creating session, success callback is public

Guest users get a session cookie (`guest_session`) automatically. When they log in, their guest cart merges into their account.

---

## Cart Endpoints

### ① Get Cart

```
GET /api/cart
```

Returns your cart with product details and totals.

**Example Response:**

```json
{
  "success": true,
  "cart": {
    "items": [
      {
        "product": {
          "_id": "664e0a1d...",
          "name": "Wireless Headphones",
          "price": 59.99
        },
        "quantity": 2,
        "itemTotal": 119.98
      }
    ],
    "totalItems": 1,
    "totalPrice": 119.98
  }
}
```

---

### ② Add Item to Cart

```
POST /api/cart/items
```

**Body:**

```json
{
  "product_id": "664e0a1d...",
  "quantity": 2
}
```

- `product_id` — **required**
- `quantity` — optional, defaults to `1`

**Success:** `200` → `"Item added to cart"`

**Possible Errors:**

| Code | Why |
|------|-----|
| 400 | `product_id is required` |
| 400 | `Not enough stock` |
| 404 | `Product not found` |

---

### ③ Update Quantity

```
PATCH /api/cart/items/:productId
```

Sets the item quantity to a new value (replaces, doesn't add).

**Body:**

```json
{
  "quantity": 5
}
```

**Success:** `200` → `"Quantity updated"`

**Possible Errors:**

| Code | Why |
|------|-----|
| 400 | `Quantity must be at least 1` |
| 400 | `Not enough stock` |
| 404 | `Item not found in cart` |

---

### ④ Remove Item

```
DELETE /api/cart/items/:productId
```

Removes one product from your cart.

**Success:** `200` → `"Item removed from cart"`

**Error:** `404` → `"Item not found in cart"`

---

### ⑤ Clear Cart

```
DELETE /api/cart
```

Removes **all** items from your cart.

**Success:** `200` → `"Cart cleared"`

---

## Checkout & Payment

### ⑥ Checkout  🔒

```
POST /api/cart/checkout
```

> **Requires login** — send your Bearer token

Converts your cart into a pending order. Validates stock but does **not** deduct inventory yet (that happens after payment).

**Body:**

```json
{
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Cairo",
    "state": "Cairo",
    "zip": "11511",
    "country": "Egypt"
  },
  "paymentMethod": "card"
}
```

- `shippingAddress` — **required**
- `paymentMethod` — optional, defaults to `"card"`

**Success Response** `201`:

```json
{
  "success": true,
  "message": "Order created successfully",
  "order_id": "664f2c4e...",
  "orderNumber": "ORD-A1B2C3D4",
  "totalAmount": 119.98
}
```

**Possible Errors:**

| Code | Why |
|------|-----|
| 401 | `Please sign in to checkout` |
| 400 | `Cart is empty` |
| 400 | `A product in your cart no longer exists` |
| 400 | `Not enough stock for "Product Name". Available: X` |
| 400 | `Shipping address is required` |

---

### ⑦ Create Payment Session  🔒

```
POST /payment/checkout/create/:orderId
```

> **Requires login** — send your Bearer token
>
> **No body needed** — just pass the `order_id` from checkout in the URL

**Example:**

```
POST /payment/checkout/create/664f2c4e...
```

**Response:**

```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

→ Redirect the user to this `url` to pay on Stripe's checkout page.

**Stripe Test Card:** `4242 4242 4242 4242`, any future expiry, any CVC.

---

### ⑧ Payment Success (automatic)

```
GET /payment/success?session_id=cs_test_...
```

> **No auth needed** — Stripe redirects the browser here after payment

This happens automatically. When called:
1. ✅ Payment status → `completed`
2. ✅ Order status → `processing`
3. ✅ Order marked as paid
4. ✅ Product inventory deducted
5. ✅ Sold count incremented

---

## Quick Reference

| # | Action | Method | Endpoint | Auth |
|---|--------|--------|----------|------|
| 1 | Get cart | `GET` | `/api/cart` | No |
| 2 | Add item | `POST` | `/api/cart/items` | No |
| 3 | Update qty | `PATCH` | `/api/cart/items/:productId` | No |
| 4 | Remove item | `DELETE` | `/api/cart/items/:productId` | No |
| 5 | Clear cart | `DELETE` | `/api/cart` | No |
| 6 | Checkout | `POST` | `/api/cart/checkout` | 🔒 Yes |
| 7 | Pay | `POST` | `/payment/checkout/create/:orderId` | 🔒 Yes |
| 8 | Success | `GET` | `/payment/success?session_id=...` | No |
