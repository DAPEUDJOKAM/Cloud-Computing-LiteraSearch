const mysql = require("mysql2");

const pool = mysql
  .createPool({
    connectionLimit: 10,
    host: "localhost", //0.0.0.0
    //app.env PORT = 5000
    user: "root",
    password: "",
    database: "literasearch",
  })
  .promise();

module.exports = pool;
