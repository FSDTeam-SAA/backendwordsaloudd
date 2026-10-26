import multer from "multer";

const storage = multer.memoryStorage();
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "video/mp4"]);
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) return callback(new Error("Only JPG, PNG, and MP4 files are allowed"));
    callback(null, true);
  },
});

export default upload;

const imageUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 7 },
  fileFilter: (req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.mimetype)) {
      const error = new Error("Photos must be JPG, PNG, WebP, HEIC, or HEIF images");
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

export const profileImagesUpload = (includeWorkPhotos = false) => {
  const fields = ["profileImage", "avatar"].map((name) => ({ name, maxCount: 1 }));
  if (includeWorkPhotos) fields.push({ name: "workPhotos", maxCount: 6 }, { name: "workPhotos[]", maxCount: 6 });
  return (req, res, next) => imageUpload.fields(fields)(req, res, (error) => {
    if (error) return next(error);
    const avatars = [...(req.files?.profileImage || []), ...(req.files?.avatar || [])];
    const photos = [...(req.files?.workPhotos || []), ...(req.files?.["workPhotos[]"] || [])];
    if (avatars.length > 1 || photos.length > 6) return next(new multer.MulterError("LIMIT_FILE_COUNT"));
    req.file = avatars[0];
    req.workPhotoFiles = photos;
    next();
  });
};

export const workPhotosUpload = (req, res, next) => imageUpload.fields([
  { name: "workPhotos", maxCount: 6 }, { name: "workPhotos[]", maxCount: 6 },
])(req, res, (error) => {
  if (error) return next(error);
  const files = [...(req.files?.workPhotos || []), ...(req.files?.["workPhotos[]"] || [])];
  if (files.length > 6) return next(new multer.MulterError("LIMIT_FILE_COUNT"));
  req.workPhotoFiles = files;
  next();
});
