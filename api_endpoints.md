API ENDPOINTS SUMMARY
1- user Management 


2- Products
API ENDPOINTS SUMMARY

#	Method	Endpoint	Description	Access
1	GET	/api/products	Get all products	Public
2	GET	/api/products/search?q=iphone	Search products	Public
3	GET	/api/products/:id	Get single product	Public
4	GET	/api/products/user/me	Get my products	User
5	POST	/api/products	Create product	Admin
6	PUT	/api/products/:id	Update product	Admin
7	DELETE	/api/products/:id	Delete product	Admin
8	POST	/api/products/:id/images	Add images	Admin
9	GET	/api/products/admin/low-stock	Low stock alerts	Admin

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
API ENDPOINTS 

Method	Endpoint	Description	Access
GET	/api/categories	Get all categories	Public
GET	/api/categories/:id	Get one category	Public
POST	/api/categories	Create category	Admin
PUT	/api/categories/:id	Update category	Admin
DELETE	/api/categories/:id	Delete category	Admin