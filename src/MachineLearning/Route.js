const router = require("express").Router();
const verify = require("../Helper/verifyToken");
const {
    trainAndSaveModel,
    predictCampaignDetails,
} = require("./Controller");

router.get("/train", verify, trainAndSaveModel);
router.get("/predict", verify, predictCampaignDetails);

module.exports = router;