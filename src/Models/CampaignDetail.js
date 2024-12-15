const mongoose = require('mongoose');

const campaignDetailSchema = new mongoose.Schema({
  campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  recipient: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Sent', 'Failed', 'Delivered', 'Read'], required: true, default: 'Pending' },
  created_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, required: false}
});

module.exports =  campaignDetailSchema;