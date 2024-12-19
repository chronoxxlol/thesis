const mongoose = require('mongoose');

const predictedDetailSchema = new mongoose.Schema({
  campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  recipient: { type: String, required: true },
  region: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Sent', 'Failed', 'Delivered', 'Read'], required: true, default: 'Pending' },
  predicted_status: { type: String, enum: ['Pending', 'Sent', 'Failed', 'Delivered', 'Read'], required: false },
  prediction_confidence: { type: Number, min: 0, max: 1, required: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, required: false },
  deleted_at: { type: Date, required: false },
  predicted_at: { type: Date, required: false },
  prediction_version: { type: String, required: false },
  is_prediction: { type: Boolean, default: true },
});

module.exports = predictedDetailSchema;