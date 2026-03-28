const jwt = require("jsonwebtoken");

/**
 * Middleware to authenticate a JWT token.
 * Checks the Authorization header for a Bearer token.
 * If valid, attaches the decoded payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    req.user = decoded; // store user info in request for later middleware/routes
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Middleware factory to check if a user has a specific permission.
 * Usage: requirePermission("send_campaigns")
 */

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

function requireAnyPermission(perms) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) return res.status(403).json({ error: "Forbidden" });

    const hasPermission = perms.some(p => req.user.permissions.includes(p));
    if (!hasPermission) return res.status(403).json({ error: "Forbidden" });

    next();
  };
}

module.exports = {
  authenticateToken,
  requirePermission,
  requireAnyPermission
};