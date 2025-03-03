const Account = require("../Models/Account")
const Campaign = require("../Models/Campaign");
const CampaignDetail = require("../Models/CampaignDetail");

const faker = require('@faker-js/faker');

const { createConnection } = require("../Helper/commonFunction");

async function generateCampaignDetail(req, res) {
  let accountId = req.query.account_id;
  const connectionGlobal = createConnection("global");
  const accountModel = connectionGlobal.model("Account", Account);
  if(!accountId) return res.status(404).json({ message: 'Account ID not provided!' });

  let accountData = await accountModel.findOne({ _id: accountId }).lean();
  if(!accountData) return res.status(404).json({ message: 'Account not found!' });
  
  const connection = createConnection(accountData.db_name);
  const campaignModel = connection.model("Campaign", Campaign);
  const campaignDetailModel = connection.model("CampaignDetail", CampaignDetail)
  try {
    let campaign_id = req.params.campaignId

    const getRandomdate = (start) => {
      const oneMonthLater = new Date(start);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      return new Date(start.getTime() + Math.random() * (oneMonthLater.getTime() - start.getTime()));
    };

    const getCampaign = await campaignModel.findOne({ _id: campaign_id });
    if (!getCampaign) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }

    const customers = getCampaign.customers;
    if (customers.length <= 0) {
      return res.status(400).json({ message: 'Campaign has no customers.' });
    }

    const customerCount = customers.length;
    const deduction = customerCount * 10;
    if (accountData.balance < deduction) {
      return res.status(400).json({ message: 'Insufficient balance to generate campaign details.' });
    }

    await accountModel.updateOne(
      { _id: accountId },
      { $inc: { balance: -deduction } }
    );

    const existingDetailsCount = await campaignDetailModel.countDocuments({ campaign_id });
    if (existingDetailsCount === customers.length) {
      return res.status(400).json({ message: 'Campaign already has details for all customers.' });
    }
    const scheduleDate = getCampaign.schedule ? new Date(getCampaign.schedule) : new Date();
    const startGenerateDate = scheduleDate > new Date() ? scheduleDate : new Date();

    const regions = [
      "Jakarta",
      "Bali",
      "Yogyakarta",
      "Bandung",
      "Surabaya",
      "Medan",
      "Makassar",
      "Palembang",
      "Semarang",
      "Batam",
      "Padang",
      "Pekanbaru",
    ];

    const details = customers.map((customer) => ({
      campaign_id,
      name: customer.name,
      recipient: customer.phone,
      region: regions[Math.floor(Math.random() * regions.length)],
      message: getCampaign.template,
      status: 'Pending',
      created_at: getRandomdate(startGenerateDate),
      updated_at: null,
    }));

    const createdDetails = await campaignDetailModel.insertMany(details);

    res.status(201).json({ message: 'Campaign details generated successfully.', details: createdDetails });
  } catch (error) {
    console.error('Error generating campaign details:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

async function updateStatusCampaignDetail(req, res) {
  let accountId = req.query.account_id;
  const connectionGlobal = createConnection("global");
  const accountModel = connectionGlobal.model("Account", Account);
  if(!accountId) return res.status(404).json({ message: 'Account ID not provided!' });

  let accountData = await accountModel.findOne({ _id: accountId }).lean();
  if(!accountData) return res.status(404).json({ message: 'Account not found!' });

  const connection = createConnection(accountData.db_name);
  const campaignDetailModel = connection.model("CampaignDetail", CampaignDetail);

  try {
    const campaignId = req.params.campaignId
    const statuses = ["Sent", "Failed", "Delivered", "Read"];
    const pendingDetails = await campaignDetailModel.find({ status: "Pending", campaign_id: campaignId});

    if (pendingDetails.length === 0) {
      return res.status(404).json({ message: "No pending campaign details found." });
    }

    const updatedDetails = await Promise.all(
      pendingDetails.map((detail) =>
        campaignDetailModel.findByIdAndUpdate(
          detail._id,
          {
            status: statuses[Math.floor(Math.random() * statuses.length)],
            updated_at: new Date(),
          },
          { new: true }
        )
      )
    );

    res.status(200).json({
      message: "Campaign details status updated successfully.",
      details: updatedDetails,
    });
  } catch (error) {
    console.error("Error randomizing campaign detail status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
}

async function getCampaignDetail(req, res) {
  let accountId = req.query.account_id;
  const connectionGlobal = createConnection("global");
  const accountModel = connectionGlobal.model("Account", Account);
  if(!accountId) return res.status(404).json({ message: 'Account ID not provided!' });

  let accountData = await accountModel.findOne({ _id: accountId }).lean();
  if(!accountData) return res.status(404).json({ message: 'Account not found!' });

  const connection = createConnection(accountData.db_name);
  const campaignModel = connection.model("Campaign", Campaign);
  const campaignDetailModel = connection.model("CampaignDetail", CampaignDetail);
  try {
    const { campaignId } = req.params;
    const { value, order, sort, page = 1, limit = 5 } = req.query;

    const campaign = await campaignModel.findOne({ _id: campaignId, deleted_at: null });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }

    const query = { campaign_id: campaignId };
    if (value) {
      query.$or = [
        { region: { $regex: value, $options: 'i' } },
        { name: { $regex: value, $options: 'i' } },
        { recipient: { $regex: value, $options: 'i' } },
      ];
    }
    const sortObject = {};
    if (order && (sort === '1' || sort === '-1')) {
      sortObject[order] = parseInt(sort);
    }
    const campaignDetails = await campaignDetailModel.find(query).sort(sortObject);
    const totalDetails = campaignDetails.length;
    const totalPages = Math.ceil(totalDetails / limit);

    const paginatedDetails = campaignDetails.slice((page - 1) * limit, page * limit);

    const customersCount = Object.keys(campaign.customers || {}).length;

    const detailStatusSummary = campaignDetails.reduce((acc, detail) => {
      acc[detail.status] = (acc[detail.status] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      campaign: {
        campaign_id: campaign._id,
        name: campaign.name,
        customersCount,
        template: campaign.template,
        schedule: campaign.schedule,
        phone_sender: campaign.phone_sender,
        created_at: campaign.created_at,
      },
      details: paginatedDetails.map((detail) => ({
        customer: detail.name,
        recipient: detail.recipient,
        status: detail.status,
        message: detail.message,
        region: detail.region,
        created_at: detail.created_at,
      })),
      pagination: {
        totalDetails,
        totalPages,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      },
      detailStatuses: detailStatusSummary,
    });
  } catch (err) {
    console.error('Error fetching campaign details:', err);
    res.status(500).json({ message: 'Unable to fetch campaign details. Please try again.' });
  }
}

module.exports = {
  generateCampaignDetail,
  updateStatusCampaignDetail,
  getCampaignDetail,
}
