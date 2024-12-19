const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require('cors');

// const customerRoute = require("./src/Customer/Route");
const accountRoute = require("./src/Account/Route");
const campaignRoute = require("./src/Campaign/Route");
const campaignDetailRoute = require("./src/CampaignDetail/Route");
const machineLearningRoute = require("./src/MachineLearning/Route")
dotenv.config();

//Connect to DB
mongoose.connect(`mongodb+srv://joel:internship@testcluster.ngs8zbl.mongodb.net/global?retryWrites=true&w=majority&appName=testCluster&authSource=admin`, {
  socketTimeoutMS: 40000,
  connectTimeoutMS: 40000,
})
.then(() => console.log("Connected to DB"))
.catch((error) => console.error("Error connecting to DB:", error));

//middleware
app.use(express.json({limit: "50mb"}));
app.use(cors());

//Route Middleware
// app.use("/api/v1/customer", customerRoute);
app.use("/api/v1/account", accountRoute);
app.use("/api/v1/campaign", campaignRoute);
app.use("/api/v1/campaign-detail", campaignDetailRoute);
app.use("/api/v1/machine-learning", machineLearningRoute);

app.listen(5000, () => console.log("Server Up And Running"));
module.exports = app;