const router = require("express").Router();
const verify = require("../Helper/verifyToken");
const {
  createCampaign,
  getCampaign,
  deleteCampaign,
  generateCampaign,
} = require('./Controller');

router.post('/create', verify, createCampaign);
router.get('/get', verify, getCampaign);
router.delete('/delete/:campaignId', verify, deleteCampaign);
router.get('/generate', verify, generateCampaign);

module.exports = router;