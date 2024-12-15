const router = require("express").Router();
const verify = require("../Helper/verifyToken");
const {
    generateCampaignDetail,
    getCampaignDetail
} = require("./Controller");

router.get("/generate/:campaignId", verify, generateCampaignDetail);
router.get("/get/:campaignId", verify, getCampaignDetail);

module.exports = router;