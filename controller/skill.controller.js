import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { TRAVEL_RANGES, RATE_UNITS } from "../constants/skills.js";
import { getActiveCategoryNames } from "../utils/adminHelpers.js";

export const getSkillOptions = catchAsync(async (req, res) => {
  const skills = await getActiveCategoryNames();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Options fetched",
    data: {
      skills,
      travelRanges: TRAVEL_RANGES,
      rateUnits: RATE_UNITS,
    },
  });
});
