const jwt = require("jsonwebtoken");

const ROLE_MAP = {
  1: "admin",
  2: "manager",
  3: "pharmacist",
  4: "cashier"
};

const normalizeRole = (role) => {
  if (
    role === undefined ||
    role === null
  ) {
    return null;
  }

  const numericRole =
    Number(role);

  if (
    Number.isInteger(numericRole) &&
    ROLE_MAP[numericRole]
  ) {
    return ROLE_MAP[numericRole];
  }

  return String(role)
    .trim()
    .toLowerCase();
};

/**
 * Verify JWT access token.
 */
const protect = (
  req,
  res,
  next
) => {
  const authHeader =
    req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith(
      "Bearer "
    )
  ) {
    return res.status(401).json({
      success: false,
      message:
        "Access denied. A valid Bearer token is required."
    });
  }

  const token =
    authHeader
      .slice(7)
      .trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message:
        "Access denied. No token provided."
    });
  }

  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    console.error(
      "JWT_SECRET is not configured."
    );

    return res.status(500).json({
      success: false,
      message:
        "Authentication configuration error."
    });
  }

  try {
    const decoded =
      jwt.verify(
        token,
        secret
      );

    const normalizedRole =
      normalizeRole(
        decoded.role
      );

    req.user = {
      ...decoded,

      roleId:
        Number.isInteger(
          Number(decoded.role)
        )
          ? Number(decoded.role)
          : decoded.roleId || null,

      role: normalizedRole
    };

    next();
  } catch (error) {
    const message =
      error.name ===
      "TokenExpiredError"
        ? "Access token has expired."
        : "Invalid access token.";

    return res.status(401).json({
      success: false,
      message
    });
  }
};

/**
 * Role-based authorization.
 *
 * Numeric ও string—দুই ধরনের
 * roles support করে।
 */
const authorize = (...roles) => {
  const allowedRoles =
    roles
      .map(normalizeRole)
      .filter(Boolean);

  return (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication is required."
      });
    }

    const userRole =
      normalizeRole(
        req.user.role
      );

    if (
      !userRole ||
      !allowedRoles.includes(
        userRole
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          `User role '${userRole || "unknown"}' ` +
          "is not authorized to access this route."
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize
};