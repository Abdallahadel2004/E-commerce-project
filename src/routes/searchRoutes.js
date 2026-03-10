// routes/searchRoutes.js
import express from "express";
import { smartSearch, searchSuggest } from "../controllers/searchController.js";

const router = express.Router();

router.get("/", smartSearch); // GET /api/search?q=headphones
router.get("/suggest", searchSuggest); // GET /api/search/suggest?q=head

export default router;
