// 404 Not Found Error Handler
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error); // error-টিকে globalErrorHandler-এর কাছে পাঠিয়ে দেওয়া হলো
};

// Global Error Handler
const globalErrorHandler = (err, req, res, next) => {
    // যদি স্ট্যাটাস কোড 200 থাকে (অথচ এরর হয়েছে), তাহলে সেটিকে 500 করে দেওয়া
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    res.status(statusCode).json({
        success: false,
        message: err.message,
        // প্রোডাকশন মোডে Stack Trace লুকিয়ে রাখা সিকিউরিটির জন্য জরুরি
        stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
};

module.exports = {
    notFoundHandler,
    globalErrorHandler,
};
