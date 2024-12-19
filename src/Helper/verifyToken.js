const jwt = require("jsonwebtoken");
const Admin = require("../Models/Admin")
const { createConnection } = require("../Helper/commonFunction");

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;

    const globalDb = createConnection('global');
    const adminModel = globalDb.model('Admin', Admin);

    const admins = await adminModel.find({ _id: verified.id });
    if (!admins || admins.length === 0) {
      return res.status(404).json({ message: 'No accounts found for this user.' });
    }
    req.admin = admins;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
};