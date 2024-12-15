const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  is_admin: { type: Boolean, required: true },
  created_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, required: false }
});

module.exports = adminSchema;