/**
 * Internal API key guard — downstream services verify the gateway injected key.
 */
module.exports = function verifyInternalKey(req, res, next) {
  const key = req.headers["x-internal-key"];

  if (!process.env.INTERNAL_API_KEY) {
    console.error("FATAL: INTERNAL_API_KEY not configured");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  if (key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};
