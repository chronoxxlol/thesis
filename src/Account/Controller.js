const Admin = require("../Models/Admin");
const Account = require("../Models/Account");
const Campaign = require("../Models/Campaign");
const { createConnection, closeConnection } = require("../Helper/commonFunction");

const bcrypt = require("bcrypt")
const { faker } = require("@faker-js/faker")
const jwt = require("jsonwebtoken")
const moment = require("moment")

async function getAllAccounts(req, res) {
  const connection = createConnection("global")
  const accountModel = await connection.model("Account", Account);
  try {
    const { page = 1, limit = 10 } = req.query;
    let [accounts, totalAccounts] = await Promise.all([
      accountModel.find({created_by: req.user.id})
        .skip((page - 1) * limit)
        .limit(limit),
      accountModel.find({created_by: req.user.id}).countDocuments()
    ]) 

    const accountsWithCampaigns = await Promise.all(
      accounts.map(async (account) => {
        const accountConnection = await createConnection(account.db_name);
        const campaignModel = accountConnection.model("Campaign", Campaign);

        const campaigns = await campaignModel.find({ created_by: account._id });

        const statusSummary = campaigns.reduce((acc, campaign) => {
          acc[campaign.status] = (acc[campaign.status] || 0) + 1;
          return acc;
        }, {});

        closeConnection([accountConnection]);

        return {
          ...account.toObject(),
          campaignCount: campaigns.length,
          campaignStatuses: statusSummary,
        };
      })
    );

    return res.json({
      data: accountsWithCampaigns,
      total: totalAccounts,
      page: page,
      total_pages: Math.ceil(totalAccounts / limit),
      limit: limit,
    });
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).send({ message: 'Unable to fetch data. Please try again.' });
  }
}

async function getAccountByID(req, res) {
  const connection = await createConnection("global");
  const accountModel = connection.model("Account", Account);

  try {
    const account = await accountModel.findOne({ _id: req.params.accId, created_by: req.user.id });
    if (!account) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    const accountConnection = await createConnection(account.db_name);
    const campaignModel = accountConnection.model("Campaign", Campaign);

    const campaigns = await campaignModel.find({ created_by: account._id });

    const statusSummary = campaigns.reduce((acc, campaign) => {
      acc[campaign.status] = (acc[campaign.status] || 0) + 1;
      return acc;
    }, {});

    closeConnection([accountConnection]);

    return res.json({
      data: {
        ...account.toObject(),
        campaignCount: campaigns.length,
        campaignStatuses: statusSummary,
      },
    });
  } catch (err) {
    console.error('Error fetching account:', err);
    res.status(500).send({ message: 'Unable to fetch data. Please try again.' });
  }
}

async function createAccount(req, res) {
  try {
    const { name, username, email, balance } = req.body;

    if(!name) return res.status(400).json({ message: `Name is required!` });
    else if(!email) return res.status(400).json({ message: `Email is required!` });
    else if(!username) return res.status(400).json({ message: `Username is required!` })

    const globalDb = createConnection("global");
    const accountModel = globalDb.model("Account", Account);

    const existingAccount = await accountModel.findOne({ name: name });
    if (existingAccount) {
      return res.status(400).json({ message: 'Account already exists.' });
    }

    const formattedDate = moment().format('YYYY_MM_DD');
    const formattedName = `${name.replace(/\s+/g, '_')}_${formattedDate}`;

    const newAccount = new accountModel({
      name,
      email,
      username,
      db_name: formattedName,
      balance: balance || 0,
      created_by: req.user.id
    });

    let [connection] = await Promise.all([
      createConnection(formattedName),
      newAccount.save(),
    ]) 

    closeConnection([connection, globalDb])
    res.status(201).json({ message: 'Account created successfully.', account: newAccount });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

async function registerAdmin(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username) return res.status(400).json({ message: 'Username field is required.' });
    if (!email) return res.status(400).json({ message: 'Email field is required.' });
    if (!password) return res.status(400).json({ message: 'Password field is required.' });

    const globalDb = createConnection('global');
    const adminModel = globalDb.model("Admin", Admin);

    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ message: 'Admin already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new adminModel({
      username,
      email,
      password: hashedPassword,
      is_admin: true,
      deleted_at: null
    });

    await newAdmin.save();

    res.status(201).json({
      message: 'Admin registered successfully.',
      user: { id: newAdmin._id, username, email },
    });
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

async function getAdmin(req, res) {
  const globalDb = createConnection("global");
  const adminModel = globalDb.model("Admin", Admin);

  try{
    let adminId = req.params.adminId
    const admin = await adminModel.findOne({ _id: adminId }, { password: 0 });

    if(!admin) return res.status(404).json({ message: 'Admin not found!' });

    res.status(201).json({
      data: admin
    })
  }catch(error){
    console.error('Error getting admin data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const globalDb = createConnection("global");
    const adminModel = globalDb.model("Admin", Admin);
    const user = await adminModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET
    );

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

async function generateAccount(req, res) {
  try {
    const fakeAccount = {
      name: faker.company.name(),
      email: faker.internet.email(),
      balance: faker.finance.amount(0, 10000, 0),
    };

    const username = fakeAccount.name.replace(/\s+/g, '_').toLowerCase();
    if (username.length > 20) {
      username = username.slice(0, 20);
    }

    const globalDb = createConnection("global");
    const accountModel = globalDb.model("Account", Account);

    const existingAccount = await accountModel.findOne({ name: fakeAccount.name });
    if (existingAccount) {
      return res.status(400).json({ message: 'Account with the same name already exists.' });
    }

    const formattedDate = moment().format('YYYY_MM_DD');
    const dbName = `${username}_${formattedDate}`;

    const newAccount = new accountModel({
      name: fakeAccount.name,
      username: username,
      email: fakeAccount.email,
      db_name: dbName,
      balance: fakeAccount.balance,
      created_by: req.user.id,
    });

    let [connection] = await Promise.all([
      createConnection(dbName),
      newAccount.save(),
    ]);

    closeConnection([connection, globalDb]);

    res.status(201).json({
      message: 'Fake account generated successfully.',
      account: newAccount,
    });
  } catch (error) {
    console.error('Error generating fake account:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

async function deleteAccount(req, res) {
  const connection = createConnection("global");
  const accountModel = connection.model("Account", Account);
  try {
    const account = await accountModel.findOne({ _id: req.params.accId, created_by: req.user.id });

    if (!account) {
      return res.status(404).json({ message: 'Account not found or access denied.' });
    }

    if (account.deleted_at) {
      return res.status(400).json({ message: 'Account is already deleted.' });
    }

    account.deleted_at = new Date();
    await account.save();

    res.status(200).json({ message: 'Account deleted successfully.', account });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

module.exports = {
  getAllAccounts,
  getAccountByID,
  registerAdmin,
  getAdmin,
  login,
  createAccount,
  generateAccount,
  deleteAccount,
};
