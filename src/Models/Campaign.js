const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name: { type: String, required: true },
    customers: [{ type: Object, required: false }],
    status: { type: String, required: true },
    template: { type: String, required: true },
    schedule: { type: Date, required: false },
    phone_sender: { type: String, required: false },
    created_by: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    deleted_at: { type: Date, required: false },
  });

module.exports = campaignSchema;