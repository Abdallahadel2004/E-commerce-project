POSTMAN EXAMPLES

WISHLIST TESTS

1. Get Wishlist

Method: GET
URL: http://localhost:3000/wishlist
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
2. Add to Wishlist

Method: POST
URL: http://localhost:3000/wishlist/add/PRODUCT_ID_HERE
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
Body: none
3. Remove from Wishlist

Method: DELETE
URL: http://localhost:3000/wishlist/remove/PRODUCT_ID_HERE
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
4. Clear Wishlist

Method: DELETE
URL: http://localhost:3000/wishlist/clear
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
PROMO CODE TESTS

5. Validate Promo Code

Method: POST
URL: http://localhost:3000/promo/validate
Headers: Content-Type: application/json
Body:
json
{
    "code": "SAVE20",
    "orderTotal": 100
}
6. Create Promo (Admin)

Method: POST
URL: http://localhost:3000/promo
Headers:

text
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json
Body:
json
{
    "code": "SAVE20",
    "type": "percentage",
    "value": 20,
    "minOrder": 50,
    "maxDiscount": 50,
    "usageLimit": 100,
    "validFrom": "2024-01-01",
    "validUntil": "2024-12-31"
}
7. Get All Promos (Admin)

Method: GET
URL: http://localhost:3000/promo
Headers:

text
Authorization: Bearer ADMIN_TOKEN
8. Update Promo (Admin)

Method: PUT
URL: http://localhost:3000/promo/PROMO_ID_HERE
Headers:

text
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json
Body:
json
{
    "value": 25,
    "maxDiscount": 75
}
9. Delete Promo (Admin)

Method: DELETE
URL: http://localhost:3000/promo/PROMO_ID_HERE
Headers:

text
Authorization: Bearer ADMIN_TOKEN
REVIEW TESTS

10. Add Review

Method: POST
URL: http://localhost:3000/reviews
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
Body:
json
{
    "product": "PRODUCT_ID_HERE",
    "rating": 5,
    "title": "Excellent product!",
    "comment": "Really love this product, works great!",
    
}
11. Get Product Reviews

Method: GET
URL: http://localhost:3000/reviews/product/PRODUCT_ID_HERE?page=1&limit=10
12. Get My Reviews

Method: GET
URL: http://localhost:3000/reviews/my-reviews
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
13. Update Review

Method: PUT
URL: http://localhost:3000/reviews/REVIEW_ID_HERE
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
Body:
json
{
    "rating": 4,
    "comment": "Updated review - still good but..."
}
14. Delete Review

Method: DELETE
URL: http://localhost:3000/reviews/REVIEW_ID_HERE
Headers:

text
Authorization: Bearer YOUR_JWT_TOKEN
