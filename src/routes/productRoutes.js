import express from "express";
import {
    createProduct,
    getProducts,
    getFeaturedProducts,
    getProductsByCategory,
    getProductById,
    updateProduct,
    uploadImages,
    deleteProduct,
    deleteImage,
    setPrimaryImage,
    searchProducts,
    deleteProduct,
    deleteImage,
    checkStock,
    bulkUpdateProducts

} from "../controllers/productController.js";

const router = express.Router();

router.post("/", createProduct);
router.get("/", getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/search", searchProducts);
router.get("/:id", getProductById);
router.put("/:id", updateProduct);
router.post("/:id/images", uploadImages);
router.delete("/:id", deleteProduct);
router.delete("/:id/images/:imageId", deleteImage);
router.put("/:id/images/:imageId/primary", setPrimaryImage);
router.get("/:id/stock", checkStock);
router.put("/bulk-update", bulkUpdateProducts); 


export default router;  
