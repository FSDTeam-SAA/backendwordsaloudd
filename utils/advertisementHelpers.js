import AppError from "../errors/AppError.js";

export const advertisementStatus = (ad, now = new Date()) => {
  if (!ad.isActive) return "disabled";
  if (ad.endDate && new Date(ad.endDate) < now) return "expired";
  if (ad.startDate && new Date(ad.startDate) > now) return "scheduled";
  return "running";
};

export const activeAdvertisementFilter = (category, now = new Date()) => ({
  isActive: true,
  $and: [
    { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
    { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ...(category ? [{ $or: [{ categories: { $size: 0 } }, { categories: category }] }] : []),
  ],
});

export const advertisementDates = (start, end) => {
  const startDate = start ? new Date(start) : new Date();
  const endDate = end ? new Date(end) : null;
  if (!Number.isFinite(startDate.getTime()) || (endDate && !Number.isFinite(endDate.getTime()))) {
    throw new AppError(400, "Advertisement dates are invalid");
  }
  if (endDate && endDate <= startDate) throw new AppError(400, "End date must be after the start date");
  return { startDate, endDate };
};
