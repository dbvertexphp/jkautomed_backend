import express from "express";
import { checkServiceability } from "../controllers/shiprocketControllers.js";

const router = express.Router();

router.post("/serviceability", checkServiceability);

export default router;
