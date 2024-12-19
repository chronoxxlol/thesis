const Account = require("../Models/Account")
const Campaign = require("../Models/Campaign");
const CampaignDetail = require("../Models/CampaignDetail");
const PredictedDetail = require("../Models/PredictedDetail");

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const { createConnection } = require("../Helper/commonFunction");

async function trainAndSaveModel(req, res) {
    const accountId = req.query.account_id;
    const connectionGlobal = createConnection("global");
    const accountModel = connectionGlobal.model("Account", Account);

    try {
        // --- Database Connections ---
        const accountData = await accountModel.findOne({ _id: accountId }).lean();
        const connection = createConnection(accountData.db_name);
        const campaignDetailModel = connection.model("CampaignDetail", CampaignDetail);

        // --- Fetch Data ---
        const campaignDetails = await campaignDetailModel.find().lean();
        if (!campaignDetails.length) {
            return res.status(400).json({ message: 'No campaign details available for training.' });
        }

        // --- Encoding Functions ---
        const statuses = ["Sent", "Failed", "Delivered", "Read"];
        const statusMap = statuses.reduce((acc, status, index) => ({ ...acc, [status]: index }), {});

        // --- Prepare Features and Labels ---
        const features = [];
        const labels = [];

        for (const detail of campaignDetails) {
            const regionEncoded = encodeRegion(detail.region); // One-hot encoding for regions
            const messageEncoded = encodeMessage(detail.message); // Use message length or advanced encoding
            const createdHour = new Date(detail.created_at).getHours();

            features.push([...regionEncoded, ...messageEncoded, createdHour]);
            labels.push(statusMap[detail.status]);
        }

        const featureTensor = tf.tensor2d(features);
        const labelTensor = tf.oneHot(tf.tensor1d(labels, 'int32'), statuses.length);

        // --- Model Definition ---
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [features[0].length] }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: statuses.length, activation: 'softmax' }));

        model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

        // --- Train the Model ---
        console.log('Training the model...');
        await model.fit(featureTensor, labelTensor, { epochs: 50, batchSize: 32 });
        console.log('Model training completed.');

        // --- Save the Model ---
        const modelPath = `${__dirname}/Training Model`;
        await model.save(`file://${modelPath}`);
        console.log(`Model saved at ${modelPath}`);

        res.status(200).json({ message: 'Model trained and saved successfully.' });
    } catch (error) {
        console.error('Error training and saving model:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function predictCampaignDetails(req, res) {
    const accountId = req.query.account_id;
    const campaignId = req.params.campaignId;
  
    const connectionGlobal = createConnection("global");
    const accountModel = connectionGlobal.model("Account", Account);
    const accountData = await accountModel.findOne({ _id: accountId }).lean();
    const connection = createConnection(accountData.db_name);
    const campaignModel = connection.model("Campaign", Campaign);
    const campaignDetailModel = connection.model("CampaignDetail", CampaignDetail);
    const predictedDetailModel = connection.model("PredictedDetail", PredictedDetail);
  
    try {
        const campaign = await campaignModel.findOne({ _id: campaignId });
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }
    
        const modelPath = './workspace/saved_model/model.json';
        if (!fs.existsSync(modelPath)) {
            return res.status(400).json({ message: 'Model not found. Please train and save the model first.' });
        }

        const campaignDetails = await campaignDetailModel.find({ campaign_id: campaignId });
        if (campaignDetails.length === 0) {
            return res.status(400).json({ message: "No campaign details available for prediction." });
        }
  
        const model = await tf.loadLayersModel("file://workspace/model/model.json");

        const inputData = campaignDetails.map((detail) => [
            encodeRegion(detail.region),
            encodeMessage(detail.message),
            new Date(detail.created_at).getTime(),
        ]);
    
        const inputTensor = tf.tensor2d(inputData);
        const predictions = model.predict(inputTensor).dataSync();
    
        const statuses = ["Pending", "Sent", "Failed", "Delivered", "Read"];
        const predictedDetails = campaignDetails.map((detail, index) => {
            const predictedStatusIndex = predictions[index];
            const predictedStatus = statuses[predictedStatusIndex];
    
            return {
                campaign_id: detail.campaign_id,
                recipient: detail.recipient,
                region: detail.region,
                message: detail.message,
                status: detail.status, // Actual status
                predicted_status: predictedStatus,
                prediction_confidence: predictions[index], // Adjust if model gives confidence
                created_at: detail.created_at,
                updated_at: new Date(),
                predicted_at: new Date(),
                prediction_version: "v1.0",
                is_prediction: true,
            };
        });
  
        const createdPredictions = await predictedDetailModel.insertMany(predictedDetails);
    
        res.status(201).json({
            message: "Predictions generated successfully.",
            predictions: createdPredictions,
        });
    } catch (error) {
        console.error('Error predicting campaign details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

const regionMap = [
    "Jakarta", "Bali", "Yogyakarta", "Bandung", "Surabaya", "Medan", 
    "Makassar", "Palembang", "Semarang", "Batam", "Padang", "Pekanbaru"
];

function encodeRegion(region) {
    const encoded = new Array(regionMap.length).fill(0);
    const regionIndex = regionMap.indexOf(region);
    if (regionIndex >= 0) {
        encoded[regionIndex] = 1;
    }
    return encoded;
}

const vocabulary = [
    "halo", "ini", "campaign", "message", "example", "customers", "limited", "offer", 
    "exclusive", "discount", "gift", "free", "win", "chance", "deal", "hurry", "today", 
    "available", "end", "last", "act", "quick", "special", "new", "release", "thank", 
    "participation", "excited", "shopping", "donate", "charity", "donation", "support", 
    "together", "help", "us", "make", "change", "buy", "save", "limited-time", "unique", 
    "offer", "special", "limited", "valid", "applies", "terms", "conditions"
];

function encodeMessage(message) {
    const vector = Array(vocabulary.length).fill(0);
    const words = message.toLowerCase().split(" ");
    words.forEach((word) => {
        const index = vocabulary.indexOf(word);
        if (index !== -1) vector[index]++;
    });
    return vector;
}

module.exports = {
    trainAndSaveModel,
    predictCampaignDetails
};