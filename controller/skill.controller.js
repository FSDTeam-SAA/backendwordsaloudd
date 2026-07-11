import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { SKILLS, TRAVEL_RANGES, RATE_UNITS } from "../constants/skills.js";

export const getSkillOptions = catchAsync(async (req, res) => {
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Options fetched",
    data: {
      skills: SKILLS,
      travelRanges: TRAVEL_RANGES,
      rateUnits: RATE_UNITS,
    },
  });
});
