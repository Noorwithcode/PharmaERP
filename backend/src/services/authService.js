const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const loginUser = async (email, password) => {
    if (!email || !password) {
        throw new Error("Please provide email and password");
    }

    // 1. Find user by email
    const [users] = await db.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    const user = users[0];

    if (!user) {
        throw new Error("Invalid credentials");
    }

    // 2. Check password (এখানে user.password এর বদলে user.password_hash দিতে হবে)
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    // 3. Generate JWT Token
    const payload = {
        id: user.id,
        role: user.role_id, // আপনার টেবিলে role_id আছে
        name: user.full_name
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || "fallback_secret_key", {
        expiresIn: "1d",
    });

    return {
        user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.role_id
        },
        token
    };
};

module.exports = {
    loginUser
};
