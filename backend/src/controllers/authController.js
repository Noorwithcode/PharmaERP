const authService = require("../services/authService");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

/**
 * @desc    Auth user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        const loginData = await authService.loginUser(email, password);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: loginData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Temporary Register Function for Testing
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerTestUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        
        // 1. Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 2. Insert into database
        await db.query(
            "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, "ADMIN"]
        );
        
        res.status(201).json({ success: true, message: "Test User Created Successfully!" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    registerTestUser
};
