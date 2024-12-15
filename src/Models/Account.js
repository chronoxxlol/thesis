const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  db_name: { type: String, required: true },
  balance: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  created_by: { type: String, required: true },
  deleted_at: { type: Date, required: false },
});

module.exports = accountSchema;