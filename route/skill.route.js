import express from "express";
import { getSkillOptions } from "../controller/skill.controller.js";

const router = express.Router();

router.get("/", getSkillOptions);

export default router;
