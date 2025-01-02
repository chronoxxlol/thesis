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
  const campaignModel = connection.model("Campaign", Campaign);
  try {
    const { name, customers, template, schedule, phone_sender } = req.body;

    if (!name || !customers || !template) {
      return res.status(400).json({ message: 'Name, audience, and template are required.' });
    }

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
  const connectionGlobal = createConnection("global");
  const accountModel = connectionGlobal.model("Account", Account);

  try {
    const { account_id: accountId, page = 1, limit = 10, value, order, sort } = req.query;
    let accountIds = [];

    if (accountId) {
      accountIds = [accountId];
    } else {
      const accounts = await accountModel.find({ created_by: req.user.id }).lean();
      if (!accounts.length) {
        return res.status(404).json({ message: 'No accounts found.' });
      }
      accountIds = accounts.map(account => account._id);
    }

    const allCampaigns = [];
    const campaignDetailsByCampaignId = {};
    const dbConnections = new Map();

    await Promise.all(
      accountIds.map(async (id) => {
        const accountData = await accountModel.findOne({ _id: id }).lean();
        if (!accountData) return;

        let connection;
        if (dbConnections.has(accountData.db_name)) {
          connection = dbConnections.get(accountData.db_name);
        } else {
          connection = createConnection(accountData.db_name);
          dbConnections.set(accountData.db_name, connection);
        }

        const campaignModel = connection.model("Campaign", Campaign);
        const campaignDetailModel = connection.model("CampaignDetail", CampaignDetail);

        const query = { created_by: id, deleted_at: null };
        if (value) {
          query.$or = [
            { name: { $regex: value, $options: 'i' } },
            { template: { $regex: value, $options: 'i' } },
            { status: { $regex: value, $options: 'i' } },
          ];
        }

        // Fetch campaigns for this account
        const campaigns = await campaignModel.find(query).lean();
        allCampaigns.push(...campaigns);

        const campaignIds = campaigns.map(campaign => campaign._id);
        const campaignDetails = await campaignDetailModel.find({ campaign_id: { $in: campaignIds } });

        campaignDetails.forEach((detail) => {
          if (!campaignDetailsByCampaignId[detail.campaign_id]) {
            campaignDetailsByCampaignId[detail.campaign_id] = [];
          }
          campaignDetailsByCampaignId[detail.campaign_id].push(detail);
        });
      })
    );

    // Sort allCampaigns globally based on the "order" and "sort" query parameters
    if (order && (sort === '1' || sort === '-1')) {
      const sortDirection = parseInt(sort, 10); // 1 for ascending, -1 for descending
      allCampaigns.sort((a, b) => {
        if (sortDirection === 1) {
          return new Date(a[order]) - new Date(b[order]);
        } else {
          return new Date(b[order]) - new Date(a[order]);
        }
      });
    }

    // Pagination after sorting
    const totalCampaigns = allCampaigns.length;
    const paginatedCampaigns = allCampaigns.slice((page - 1) * limit, page * limit);

    // Add campaign details
    const campaignsWithDetails = paginatedCampaigns.map((campaign) => {
      const campaignDetails = campaignDetailsByCampaignId[campaign._id] || [];

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
        deleted_at: campaign.deleted_at,
        detailCount: campaignDetails.length,
        detailStatuses: detailStatusSummary,
      };
    });

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