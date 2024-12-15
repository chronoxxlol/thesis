const router = require("express").Router();
const verify = require("../Helper/verifyToken");
const {
  getAllAccounts,
  getAccountByID,
  registerAdmin,
  login,
  createAccount,
  generateAccount,
  deleteAccount,

} = require("./Controller");

router.get("/get", verify, getAllAccounts);
router.get("/get/:accId", verify, getAccountByID);
router.get("/generate-account", verify, generateAccount);
router.post("/create", verify, createAccount);
router.post("/login", login);
router.post("/register", registerAdmin);
router.delete("/delete/:accId", verify, deleteAccount);

module.exports = router;
