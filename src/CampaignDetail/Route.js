const router = require("express").Router();
const verify = require("../Helper/verifyToken");
const {
    generateCampaignDetail,
    getCampaignDetail,
    updateStatusCampaignDetail
} = require("./Controller");

router.get("/generate/:campaignId", verify, generateCampaignDetail);
router.get("/get/:campaignId", verify, getCampaignDetail);
router.patch("/update/:campaignId", verify, updateStatusCampaignDetail);

module.exports = router;