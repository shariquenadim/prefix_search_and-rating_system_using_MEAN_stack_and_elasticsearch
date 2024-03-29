const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/user");
const bcrypt = require('bcrypt');
const fs = require('fs');

const JWT_SECRET = "8Zz5tw0Ionm3XPZZfN0NOml3z9FMfmpgXwovR9fp6ryDIoGRM8EPHAB6iHsc0fb";

// Signup function
const signup = async (req, res, next) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    // Password complexity requirements
    const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[^\w\s]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(401).json("Password does not meet the complexity requirements");
    }
    if (password !== confirmPassword) {
      return res.status(401).json("Passwords do not match");
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });

    if (existingUser) {
      // console.log("User already exists");
      return res.status(400).json("User already exists");
    }

    const user = new User({
      name,
      email,
      phone,
      password,
    });

    await user.save();

    // Send verification email
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1d" });
    const url = `http://localhost:3000/verify-email?token=${token}`;
    // change the url according to the production

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      service: "Gmail",
      auth: {
        user: "infomotiveofficial@gmail.com",
        pass: "ipuszobdyygbwapv",
      },
    });

    const htmlTemplate = fs.readFileSync('views/verification-email.html', 'utf-8');
    const formattedHtml = htmlTemplate.replace('{{verificationUrl}}', url);

    await transporter.sendMail({
      from: "infomotiveofficial@gmail.com",
      to: email,
      subject: "Verify your Email ID for JIO EVA",
      html: formattedHtml,
    });

    res.status(201).json({ status: 201, message: "User created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred during signup" });
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // console.log("User not found.");
      return res.status(400).json("User not found");
    }

    if (!user.emailVerified) {
      // console.log("Email address not verified");
      return res.status(400).json("Email address not verified");
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      const isOldMatch = await user.comparePasswordWithOld(password);

      if (isOldMatch) {
        // console.log("You are using an old password.");
        return res.status(400).json("You are using an old password.");
      }

      // console.log("Invalid password");
      return res.status(400).json("Invalid password");
    }

    // Generate OTP code
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Save OTP in server cookie with a 2-minute expiration time
    res.cookie("otp", otp.toString(), { httpOnly: true, maxAge: 2 * 60 * 1000 });

    // Set rememberMe option if true
    if (rememberMe) {
      res.cookie("rememberMe", rememberMe.toString(), { httpOnly: true });
    }

    res.cookie("email", email.toString(), { httpOnly: true });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      service: "Gmail",
      auth: {
        user: "infomotiveofficial@gmail.com",
        pass: "ipuszobdyygbwapv",
      },
    });

    const htmlTemplate = fs.readFileSync("views/otp-email.html", "utf-8");
    const formattedHtml = htmlTemplate.replace("{{otp}}", otp);

    await transporter.sendMail({
      from: "infomotiveofficial@gmail.com",
      to: email,
      subject: "OTP For Login in Jio EVA",
      html: formattedHtml,
    });

    res.status(200).json({ message: "An OTP has been sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred during login" });
  }
};

// Logout function
const logout = (req, res) => {
  try {
    res.clearCookie("token");
    res.json("Logged out successfully");
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred during logout" });
  }
};

// Get current user function
const getCurrentUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json("Unauthorized");
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded) {
      return res.status(401).json("Unauthorized");
    }

    const { email } = decoded;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json("User does not exist");
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred while fetching user details" });
  }
};

// Function to generate a temporary token
const generateToken = (email) => {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '10m' });
};

// Function to send the password reset email
const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `http://localhost:4200/reset-password?token=${token}`;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    service: 'Gmail',
    auth: {
      user: 'infomotiveofficial@gmail.com',
      pass: 'ipuszobdyygbwapv',
    },
  });

  const htmlTemplate = fs.readFileSync('views/reset-password-email.html', 'utf-8');
  const formattedHtml = htmlTemplate.replace('{{resetUrl}}', resetUrl);

  const mailOptions = {
    from: 'infomotiveofficial@gmail.com',
    to: email,
    subject: 'EVA Password Reset!',
    html: formattedHtml,
  };

  await transporter.sendMail(mailOptions);
};

// Controller function for handling forget password request
const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      console.log("user not found");
      return res.status(401).json({ message: 'User not found' });
    }

    const token = generateToken(email);
    await sendPasswordResetEmail(email, token);

    res.status(200).json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while processing the request' });
  }
};

// Reset password function
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    try {
      // Verify the token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Check if the new password and confirm password match
      if (newPassword !== confirmPassword) {
        return res.status(403).json({ message: 'Passwords do not match' });
      }

      const { email } = decoded;

      // Find the user by email
      const user = await User.findOne({ email });

      // Check if the user exists
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if the new password is the same as the old password
      const isMatch = await user.comparePassword(newPassword);
      if (isMatch) {
        return res.status(400).json({ message: 'New password cannot be the same as the old password' });
      }

      // Assign the current password to a variable
      const currentPassword = user.password;
      // console.log("current pass:", currentPassword)

      // Move the current password to the old password field
      user.oldPassword = currentPassword;
      // console.log("old pass:", user.oldPassword)

      // Update the password field with the new password
      user.password = newPassword;
      // console.log("pass:", user.password)

      await user.save();

      res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token has expired' });
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while processing the request' });
  }
};

// Exporting the functions
module.exports = {
  signup,
  login,
  logout,
  getCurrentUser,
  forgetPassword,
  resetPassword,
};