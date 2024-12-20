const Account = require("../Models/Account");
const Campaign = require("../Models/Campaign");
const CampaignDetail = require("../Models/CampaignDetail");
const Customer = require("../Models/Customer");

const { createConnection } = require("../Helper/commonFunction");

const { faker } = require("@faker-js/faker")
const mongoose = require("mongoose");

async function createCampaign(req, res) {
  let accountId = req.body.account_id;
  const connectionGlobal = createConnection("global")
  const accountModel = connectionGlobal.model("Account", Account);
  let accountData = await accountModel.findOne({_id: accountId}).lean();

  const connection = createConnection(accountData.db_name);
  const campaignModel = await connection.model("Campaign", Campaign);
  try {
    const { name, customers, template, schedule, phone_sender } = req.body;

    if (!name || !customers || !template) {
      return res.status(400).json({ message: 'Name, audience, and template are required.' });
    }

    console.log(accountData)

    const newCampaign = new campaignModel({
      name,
      customers,
      status: "created",
      template,
      schedule,
      phone_sender,
      created_by: accountData._id,
      deleted_at: null
    });

    await newCampaign.save();

    res.status(201).json({ message: 'Campaign created successfully.', campaign: newCampaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

async function getCampaign(req, res) {
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
    const { page = 1, limit = 10, search = '', status } = req.query;
    const query = { created_by: accountId, deleted_at: null };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (status) {
      query.status = { $regex: status, $options: 'i' };
    }

    const campaigns = await campaignModel.find(query)
      .skip((page - 1) * limit)
      .limit(limit);

    const campaignsWithDetails = await Promise.all(
      campaigns.map(async (campaign) => {
        const campaignDetails = await campaignDetailModel.find({ campaign_id: campaign._id });

        const detailStatusSummary = campaignDetails.reduce((acc, detail) => {
          acc[detail.status] = (acc[detail.status] || 0) + 1;
          return acc;
        }, {});

        return {
          campaign_id: campaign._id,
          name: campaign.name,
          status: campaign.status,
          customer: Object.keys(campaign.customers || {}).length,
          template: campaign.template,
          schedule: campaign.schedule,
          phone_sender: campaign.phone_sender,
          created_at: campaign.created_at,
          detailCount: campaignDetails.length,
          detailStatuses: detailStatusSummary,
        };
      })
    );

    const totalCampaigns = await campaignModel.countDocuments({ created_by: accountId });

    return res.json({
      data: campaignsWithDetails,
      total: totalCampaigns,
      page: page,
      totalPages: Math.ceil(totalCampaigns / limit),
      limit: limit,
    });
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).send({ message: 'Unable to fetch data. Please try again.' });
  }
}

async function deleteCampaign(req, res) {
  let accountId = req.query.account_id;
  const connectionGlobal = createConnection("global");
  const accountModel = connectionGlobal.model("Account", Account);
  if(!accountId) return res.status(404).json({ message: 'Account ID not provided!' });

  let accountData = await accountModel.findOne({ _id: accountId }).lean();
  if(!accountData) return res.status(404).json({ message: 'Account not found!' });

  const connection = createConnection(accountData.db_name);
  const campaignModel = connection.model("Campaign", Campaign);
  try {
    const campaignId = req.params.campaignId;

    const campaign = await campaignModel.findOneAndUpdate(
      { _id: campaignId, created_by: accountId, deleted_at: null },
      { deleted_at: new Date() },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or already deleted.' });
    }

    res.status(200).json({ message: 'Campaign deleted successfully.', campaign });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

async function generateCampaign(req, res) {
  let accountId = req.query.account_id;
  const connectionGlobal = createConnection("global");
  const accountModel = connectionGlobal.model("Account", Account);
  if(!accountId) return res.status(404).json({ message: 'Account ID not provided!' });

  let accountData = await accountModel.findOne({ _id: accountId }).lean();
  if(!accountData) return res.status(404).json({ message: 'Account not found!' });

  const connection = createConnection(accountData.db_name);
  const campaignModel = connection.model("Campaign", Campaign);
  const customerModel = connection.model("Customer", Customer);
  try {
    const name = faker.company.name();

    const generatePhoneNumber = () => {
      const randomLength = faker.number.int({ min: 8, max: 10 });
      const randomDigits = faker.string.numeric(randomLength);
      return `62${randomDigits}`;
    };

    const customers = Array.from({ length: faker.number.int({ min: 5, max: 20 }) }, () => ({
      name: faker.person.fullName(),
      phone: generatePhoneNumber()
    }));
    
    const template = faker.lorem.paragraph();
    const schedule = faker.datatype.boolean() ? faker.date.future() : null;
    const phone_sender = faker.phone.number();

    const customerRecords = customers.map((customer) => ({
      name: customer.name,
      phone: customer.phone,
      created_by: accountData._id,
      created_at: new Date()
    }));

    const newCampaign = new campaignModel({
      name,
      customers,
      status: "created",
      template,
      schedule,
      phone_sender,
      created_by: accountData._id,
      deleted_at: null
    });

    await Promise.all([
      customerModel.insertMany(customerRecords),
      newCampaign.save()
    ]);

    res.status(201).json({
      message: 'Successfully generated new campaign.',
      campaign: newCampaign
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

module.exports = {
  createCampaign,
  generateCampaign,
  deleteCampaign,
  getCampaign
}