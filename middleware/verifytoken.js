// verifyToken.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

// Middleware to verify JWT token
const verifyToken = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1]; // Get token from header

    if (!token) {
        return res.status(401).json({ message: 'No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // JWT_SECRET should be stored in your .env file
        req.user = { id: decoded._id, role: decoded.role }; // Ensure req.user.id is set correctly
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token.' });
    }
});

module.exports = verifyToken;
