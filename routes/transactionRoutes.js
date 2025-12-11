const express = require("express");
const { addTransaction, getAllTransactions, getAllTransactionsByUser, getAllTransactionsByTeacher, getAllTransactionsInAdmin, getAllCodTransactionsInAdmin } = require("../controllers/transactionController.js");
const protect = require("../middleware/authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");

const transactionRoutes = express.Router();

transactionRoutes.route("/addTransaction").post(protect, addTransaction);
transactionRoutes.route("/getAllTransactions").post(protect, getAllTransactions);
transactionRoutes.route("/getAllTransactionsByUser").post(protect, getAllTransactionsByUser);
transactionRoutes.route("/getAllTransactionsByTeacher").post(protect, getAllTransactionsByTeacher);
transactionRoutes.route("/getAllTransactionsInAdmin").get(protect, Authorization(["admin"]), getAllTransactionsInAdmin);
transactionRoutes.route("/getAllCodTransactionsInAdmin").get(protect, Authorization(["admin"]), getAllCodTransactionsInAdmin);
module.exports = { transactionRoutes };
