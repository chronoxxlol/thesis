const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

function CustomException(value, status = 400){
  this.value = value;
  this.status = status
}

/**
 * Fungsi untuk membuat koneksi ke database
 * @param {String} dbName Nama dari database yang akan digunakan
 * @param {Object} options Option yang akan digunakan pada saat membuat koneksi, default = {useNewUrlParser: true, useUnifiedTopology: true}
 * @returns Object mongoose.createConnection
 */
function createConnection(
  dbName,
  options = {
    socketTimeoutMS: 40000,
    connectTimeoutMS: 40000,
  }
) {
  let dbConnection = `mongodb://localhost:27017/${dbName}?authSource=admin`;
  const connections = mongoose.createConnection(dbConnection, options);

  return connections;
}

/**
 * Fungsi untuk memutuskan koneksi ke db
 * @param {Array<mongoose.Connection>} connectionsArr Array yang berisi object connection
 * @returns true
 */
function closeConnection(connectionsArr){
  for(let connection of connectionsArr){
    if(!checkIfEmpty(connection)) connection.close();
  }

  return true;
}

/**
 * Fungsi untuk mengecek apakah sebuah data itu empty atau tidak.
 * Fungsi ini juga bisa digunakan untuk mengecek object dan array.
 * @param {*} data Data yang ingin dicek
 * @returns true jika data empty, dan false jika data tidak empty
 */
function checkIfEmpty(data) {
  if (Array.isArray(data)) {
    return data.length > 0 ? false : true;
  } else if (
    Object.prototype.toString.call(data) == Object.prototype.toString.call({})
  ) {
    return Object.keys(data).length > 0 ? false : true;
  } else {
    return data && data != "" ? false : true;
  }
}

module.exports = {
  CustomException,
  createConnection,
  closeConnection,
  checkIfEmpty,
};
