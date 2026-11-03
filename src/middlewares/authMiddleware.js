const jwt = require("jsonwebtoken");
const { isCurrentWebSession } = require("../utils/webSession");
const { isUserDeactivated, DEACTIVATED_MESSAGE } = require("../utils/accountStatus");

exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Header check
    if (!authHeader) {
      return res.status(401).send({
        status: false,
        message: "No token provided",
      });
    }

    // 2. Format check (Bearer TOKEN)
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).send({
        status: false,
        message: "Invalid token format",
      });
    }

    const token = authHeader.split(" ")[1];

    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Website tokens carry a session id; only the newest login is valid
    if (decoded.sid && decoded.role === 2) {
      const current = await isCurrentWebSession(decoded.id, decoded.sid);
      if (!current) {
        return res.status(401).send({
          status: false,
          code: "SESSION_REPLACED",
          message: "You were signed out because your account was signed in on another device.",
        });
      }
    }

    // 5. A deactivated student's existing tokens stop working immediately
    if (decoded.role === 2 && (await isUserDeactivated(decoded.id))) {
      return res.status(403).send({
        status: false,
        code: "ACCOUNT_DEACTIVATED",
        message: DEACTIVATED_MESSAGE,
      });
    }

    // 6. Attach user
    req.user = decoded;

    next();

  } catch (e) {
    // 5. Specific error handling
    if (e.name === "TokenExpiredError") {
      return res.status(401).send({
        status: false,
        message: "Token expired",
      });
    }

    return res.status(401).send({
      status: false,
      message: "Invalid token",
    });
  }
};