API ENDPOINTS SUMMARY
1- user Management 


2- Product 

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
