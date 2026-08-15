const buckets = new Map();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 10 * 60 * 1000);
cleanupTimer.unref();

export const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 100 } = {}) => (req, res, next) => {
  const now = Date.now();
  const key = `${req.ip}:${req.baseUrl}:${req.path}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  current.count += 1;
  if (current.count > max) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later.", errorSources: [] });
  }
  next();
};
