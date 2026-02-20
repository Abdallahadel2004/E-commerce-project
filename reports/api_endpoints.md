API ENDPOINTS SUMMARY
1- user Management 


2- Products
API ENDPOINTS SUMMARY

#	Method	Endpoint	Description	Access
1	GET.     /products	Get all products	Public
2	GET	 /products/search?q=iphone	Search products	Public
3	GET    /products/:id	Get single product	Public
4	GET	 /products/user/me	Get my products	User
5	POST	/products	Create product	Admin
6	PUT	 /products/:id	Update product	Admin
7	DELETE	 /products/:id	Delete product	Admin
8	POST	 /products/:id/images	Add images	Admin
9	GET	/products/admin/low-stock	Low stock alerts	Admin

3- cart












4-  Order
#	Method	Endpoint	Description	           Access
1	POST	 /orders	 Create new order	   Private
2	GET	 /orders/my-orders	 Get user orders	Private
3	GET	 /orders/:id	 Get single order	    Private
4	PUT	 /orders/:id/cancel	  Cancel order	     Private
5	GET	 /orders	     Get all orders	          Admin
6	PUT	 /orders/:id/status	Update order status.   Admin
7	PUT	 /orders/:id/payment Update payment       Admin

5- categray 
# Method	Endpoint	Description	Access
GET	/categories	Get all categories	Public
GET.  /categories/:id	Get one category	Public
POST	  /categories	Create category	Admin
PUT	 /categories/:id	Update category	Admin
DELETE	/categories/:id	Delete category	Admin

6- Wishlist 
# Method	Endpoint	Description	                Auth
GET.      /wishlist	Get user's wishlist	     must 
POST	    /wishlist/add/:productId	Add product	  must 
DELETE	 /wishlist/remove/:productId	Remove product	   must 
DELETE	 /wishlist/clear	Clear wishlist	          must 