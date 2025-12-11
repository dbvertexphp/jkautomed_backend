const asyncHandler = require("express-async-handler");
const Transaction = require("../models/transactionModel");
const Order = require("../models/orderModel"); // Ensure correct import path
const Product = require("../models/productModel");
const { User } = require("../models/userModel");
const { addNotification } = require("./orderNotificationController");
const { sendFCMNotification } = require("./notificationControllers");

const addTransaction = asyncHandler(async (req, res) => {
  const user_id = req.headers.userID;
  const { order_id, payment_id, payment_status, total_amount, payment_method, status, user_name } = req.body;

  if (!order_id || !total_amount || !payment_method || !status) {
    return res.status(400).json({ message: "Invalid input", status: false });
  }

  try {
    // Fetch the order details
    const order = await Order.findById(order_id).populate("items.product_id");
    if (!order) {
      return res.status(404).json({ message: "Order not found", status: false });
    }

    // Aggregate amount by supplier and product
    const items = order.items.map((item) => ({
      product_id: item.product_id._id,
      supplier_id: item.supplier_id,
      amount: item.quantity * item.product_id.price,
    }));

    // Create a single transaction document
    const newTransaction = new Transaction({
      user_id,
      order_id,
      payment_id: payment_id || null,
      payment_status: payment_status || "pending",
      total_amount,
      payment_method,
      status,
      items,
      user_name,
    });

    const savedTransaction = await newTransaction.save();

    // Send notifications and add notifications for each supplier
    for (const item of items) {
      const supplier = await User.findById(item.supplier_id);
      if (supplier.firebase_token || user.firebase_token == "dummy_token") {
        const registrationToken = supplier.firebase_token;
        const title = "Product Purchase";
        const body = `A new transaction of ${item.amount} has been made for your products.`;
        const notificationResult = await sendFCMNotification(registrationToken, title, body);
        if (notificationResult.success) {
          console.log("Notification sent successfully:", notificationResult.response);
        } else {
          console.error("Failed to send notification:", notificationResult.error);
        }
        await addNotification(user_id, order_id, body, total_amount, [item.supplier_id], title, payment_method);
      }
    }

    res.status(201).json({
      message: "Transactions added successfully",
      transaction: savedTransaction,
    });
  } catch (error) {
    console.error("Error adding transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

// Get all transactions with optional filtering, sorting, and pagination
// const getAllTransactions = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = req.query;

//   try {
//     // Fetch transactions with pagination
//     const transactions = await Transaction.find()
//       .sort({ [sortBy]: order === "desc" ? -1 : 1 })
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit));
//       // .populate("user_id order_id items.product_id items.supplier_id");

//     // Count total number of transactions
//     const totalTransactions = await Transaction.countDocuments();

//     res.status(200).json({
//       message: "Transactions fetched successfully",
//       transactions,
//       totalPages: Math.ceil(totalTransactions / limit),
//       currentPage: parseInt(page),
//       totalTransactions,
//     });
//   } catch (error) {
//     console.error("Error fetching transactions:", error.message);
//     res.status(500).json({ message: "Internal Server Error", status: false });
//   }
// });

const getAllTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = req.query;

  try {
    // Fetch transactions with pagination and populate order details
    const transactions = await Transaction.find()
      .populate({
        path: "order_id", // Populating order details
        select: "order_id",
      })
      .sort({ [sortBy]: order === "desc" ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Count total number of transactions
    const totalTransactions = await Transaction.countDocuments();

    res.status(200).json({
      message: "Transactions fetched successfully",
      transactions,
      totalPages: Math.ceil(totalTransactions / limit),
      currentPage: parseInt(page),
      totalTransactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getAllTransactionsByUser = asyncHandler(async (req, res) => {
  const { page = 1, search = "", Short = "", user_id } = req.body;
  const perPage = 10; // You can adjust this according to your requirements
  // Build the query based on search (if any)
  const query = {
    $or: [
      { "user_id.first_name": { $regex: search, $options: "i" } },
      { "user_id.last_name": { $regex: search, $options: "i" } },
      { "user_id.email": { $regex: search, $options: "i" } },
      { "teacher_id.name": { $regex: search, $options: "i" } },
      { "teacher_id.email": { $regex: search, $options: "i" } },
      {
        "teacher_id.first_name": {
          $regex: search,
          $options: "i",
        },
      },
      { "teacher_id.last_name": { $regex: search, $options: "i" } },
      { "course_id.title": { $regex: search, $options: "i" } },
    ],
  };

  // Sorting based on Short field
  let sortCriteria = {};
  if (Short === "amount") {
    sortCriteria = { amount: -1 }; // Sort by amount in descending order
  } else {
    sortCriteria = { _id: -1 }; // Default sorting
  }

  try {
    const transactions = await Transaction.find({ user_id: user_id })
      .populate({
        path: "user_id",
        select: "first_name last_name email", // Specify fields you want to populate
      })
      .populate({
        path: "teacher_id",
        select: "name email first_name last_name",
      })
      .populate({
        path: "course_id",
        select: "title category_id type",
        populate: {
          path: "category_id",
          select: "name",
        },
      })
      .sort(sortCriteria)
      .skip((page - 1) * perPage)
      .limit(perPage);

    const totalCount = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalCount / perPage);

    const paginationDetails = {
      current_page: parseInt(page),
      data: transactions,
      first_page_url: `${baseURL}api/transactions?page=1`,
      from: (page - 1) * perPage + 1,
      last_page: totalPages,
      last_page_url: `${baseURL}api/transactions?page=${totalPages}`,
      links: [
        {
          url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
          label: "&laquo; Previous",
          active: false,
        },
        {
          url: `${baseURL}api/transactions?page=${page}`,
          label: page.toString(),
          active: true,
        },
        {
          url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
          label: "Next &raquo;",
          active: false,
        },
      ],
      next_page_url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
      path: `${baseURL}api/transactions`,
      per_page: perPage,
      prev_page_url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
      to: (page - 1) * perPage + transactions.length,
      total: totalCount,
    };

    res.json({
      Transactions: paginationDetails,
      page: page.toString(),
      total_rows: totalCount,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const getAllTransactionsByTeacher = asyncHandler(async (req, res) => {
  const { page = 1, search = "", Short = "", user_id } = req.body;
  const perPage = 10; // You can adjust this according to your requirements
  // Build the query based on search (if any)
  const query = {
    $or: [
      { "user_id.first_name": { $regex: search, $options: "i" } },
      { "user_id.last_name": { $regex: search, $options: "i" } },
      { "user_id.email": { $regex: search, $options: "i" } },
      { "teacher_id.name": { $regex: search, $options: "i" } },
      { "teacher_id.email": { $regex: search, $options: "i" } },
      {
        "teacher_id.first_name": {
          $regex: search,
          $options: "i",
        },
      },
      { "teacher_id.last_name": { $regex: search, $options: "i" } },
      { "course_id.title": { $regex: search, $options: "i" } },
    ],
  };

  // Sorting based on Short field
  let sortCriteria = {};
  if (Short === "amount") {
    sortCriteria = { amount: -1 }; // Sort by amount in descending order
  } else {
    sortCriteria = { _id: -1 }; // Default sorting
  }

  try {
    const transactions = await Transaction.find({ teacher_id: user_id })
      .populate({
        path: "user_id",
        select: "first_name last_name email", // Specify fields you want to populate
      })
      .populate({
        path: "teacher_id",
        select: "name email first_name last_name",
      })
      .populate({
        path: "course_id",
        select: "title category_id type",
        populate: {
          path: "category_id",
          select: "name",
        },
      })
      .sort(sortCriteria)
      .skip((page - 1) * perPage)
      .limit(perPage);

    const totalCount = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalCount / perPage);

    const paginationDetails = {
      current_page: parseInt(page),
      data: transactions,
      first_page_url: `${baseURL}api/transactions?page=1`,
      from: (page - 1) * perPage + 1,
      last_page: totalPages,
      last_page_url: `${baseURL}api/transactions?page=${totalPages}`,
      links: [
        {
          url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
          label: "&laquo; Previous",
          active: false,
        },
        {
          url: `${baseURL}api/transactions?page=${page}`,
          label: page.toString(),
          active: true,
        },
        {
          url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
          label: "Next &raquo;",
          active: false,
        },
      ],
      next_page_url: page < totalPages ? `${baseURL}api/transactions?page=${page + 1}` : null,
      path: `${baseURL}api/transactions`,
      per_page: perPage,
      prev_page_url: page > 1 ? `${baseURL}api/transactions?page=${page - 1}` : null,
      to: (page - 1) * perPage + transactions.length,
      total: totalCount,
    };

    res.json({
      Transactions: paginationDetails,
      page: page.toString(),
      total_rows: totalCount,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// const getAllTransactionsInAdmin = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10, sortBy = "createdAt", order = "desc", search = "" } = req.query;
//   try {
//     // Build the search query
//     const searchQuery = search
//       ? {
//           $or: [
//             { user_name: { $regex: search, $options: "i" } },
//             { payment_id: { $regex: search, $options: "i" } },
//           ],
//         }
//       : {};

//     // Fetch transactions with pagination and search
//     const transactions = await Transaction.find(searchQuery)
//       .sort({ [sortBy]: order === "desc" ? -1 : 1 })
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit))
//       .populate("user_id order_id items.product_id items.supplier_id");

//     // Count total number of transactions matching the search query
//     const totalTransactions = await Transaction.countDocuments(searchQuery);

//     res.status(200).json({
//       message: "Transactions fetched successfully",
//       transactions,
//       totalPages: Math.ceil(totalTransactions / limit),
//       currentPage: parseInt(page),
//       totalTransactions,
//     });
//   } catch (error) {
//     console.error("Error fetching transactions:", error.message);
//     res.status(500).json({ message: "Internal Server Error", status: false });
//   }
// });

//edit by Atest




const getAllTransactionsInAdmin = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "" } = req.query;
  const parsedLimit = parseInt(limit);
  const parsedPage = parseInt(page);

  try {
    const pipeline = [
      // Match only online payments with success status
      {
        $match: {
          payment_method: "online",
          payment_status: "success",
        },
      },

      // Lookup order details
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "_id",
          as: "orderDetails",
        },
      },
      { $unwind: { path: "$orderDetails", preserveNullAndEmptyArrays: true } },

      // Unwind items so that each item appears separately
      { $unwind: { path: "$items" } },

      // Lookup supplier details
      {
        $lookup: {
          from: "users",
          localField: "items.supplier_id",
          foreignField: "_id",
          as: "supplierDetails",
        },
      },
      { $unwind: { path: "$supplierDetails", preserveNullAndEmptyArrays: true } },

      // Lookup user details (customer details)
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },

      // Convert datetime string to a date for sorting
      {
        $addFields: {
          datetimeConverted: { $toDate: "$datetime" },
        },
      },

      // Apply search filter if provided
      search
        ? {
            $match: {
              $or: [{ "userDetails.full_name": { $regex: search, $options: "i" } }, { "orderDetails.order_id": { $regex: search, $options: "i" } }, { payment_id: { $regex: search, $options: "i" } }, { "supplierDetails.full_name": { $regex: search, $options: "i" } }],
            },
          }
        : null,

      // Sorting by converted datetime (most recent first)
      { $sort: { datetimeConverted: -1 } },

      // Pagination
      { $skip: (parsedPage - 1) * parsedLimit },
      { $limit: parsedLimit },

      // Project only necessary fields
      {
        $project: {
          _id: 1,
          user_name: { $ifNull: ["$userDetails.full_name", "N/A"] },
          order_id: { $ifNull: ["$orderDetails.order_id", "N/A"] },
          supplier_name: { $ifNull: ["$supplierDetails.full_name", "N/A"] },
          product_id: "$items.product_id",
          total_amount: "$items.amount",
          quantity: { $ifNull: ["$items.quantity", 1] }, // Default quantity if missing
          payment_status: 1,
          payment_method: 1,
          payment_id: 1,
          datetime: { $ifNull: ["$datetime", new Date(0)] }, // Ensure datetime exists
        },
      },
    ].filter(Boolean);

    // Fetch transactions
    const transactions = await Transaction.aggregate(pipeline);

    // Count total transactions for pagination
    const totalTransactions = await Transaction.countDocuments({
      payment_method: "online",
      payment_status: "success",
    });

    res.status(200).json({
      message: "Transactions fetched successfully",
      transactions,
      totalPages: Math.ceil(totalTransactions / parsedLimit),
      currentPage: parsedPage,
      totalTransactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});


const getAllCodTransactionsInAdmin = asyncHandler(async (req, res) => {
      const { page = 1, limit = 10, sortBy = "created_at", order = "desc", search = "" } = req.query;

      try {
        const parsedLimit = parseInt(limit);
        const parsedPage = parseInt(page);

      //   console.log("Fetching transactions...");

        // Debug Step: Check total orders
        const totalCodOrders = await Order.countDocuments({ payment_method: "cod" });
      //   console.log("Total COD Orders:", totalCodOrders);

        // Step 1: Get Total Count (Before Pagination)
        const totalTransactionsPipeline = [
          { $match: { payment_method: "cod" } },
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
          { $match: { "items.status": "delivered" } },
          { $group: { _id: "$_id" } }, // Unique orders
          { $count: "total" },
        ];

        const totalResult = await Order.aggregate(totalTransactionsPipeline);
        const totalTransactions = totalResult.length > 0 ? totalResult[0].total : 0;

      //   console.log("Total Transactions After Filtering:", totalTransactions);

        // Step 2: Get Paginated Results
        const pipeline = [
          { $match: { payment_method: "cod" } },

          { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
          { $match: { "items.status": "delivered" } },

          // Debug: Log filtered order count
          {
            $group: {
              _id: "$_id",
              count: { $sum: 1 },
            },
          },
          { $count: "filteredOrders" },
        ];

      //   const filteredOrdersCount = await Order.aggregate(pipeline);
      //   console.log("Filtered Orders Count:", filteredOrdersCount.length > 0 ? filteredOrdersCount[0].filteredOrders : 0);

        const mainPipeline = [
          { $match: { payment_method: "cod" } },
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
          { $match: { "items.status": "delivered" } },

          // Populate Product
          {
            $lookup: {
              from: "products",
              let: { productId: "$items.product_id" },
              pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] } } }],
              as: "product",
            },
          },
          { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

          // Populate Supplier
          {
            $lookup: {
              from: "users",
              let: { supplierId: "$product.supplier_id" },
              pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$supplierId" }] } } }],
              as: "supplier",
            },
          },
          { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },

          // Compute Total Price
          {
            $set: {
              "items.total_price": { $multiply: ["$items.quantity", "$product.price"] },
              "items.supplier_name": "$supplier.full_name",
              "items.supplier_id": "$supplier._id",
            },
          },

          // Group by Order ID and Supplier ID
          {
            $group: {
              _id: {
                order_id: "$_id",
                supplier_id: "$items.supplier_id",
              },
              order_id: { $first: "$order_id" },
              supplier_id: { $first: "$items.supplier_id" },
              supplier_name: { $first: "$items.supplier_name" },
              user_id: { $first: "$user_id" },
              created_at: { $first: "$created_at" },
              order_status: { $first: "$items.status" },
              payment_method: { $first: "$payment_method" },
              items: {
                $push: {
                  product_id: "$items.product_id",
                  quantity: "$items.quantity",
                  total_price: "$items.total_price",
                },
              },
              total_amount: { $sum: "$items.total_price" },
              total_quantity: { $sum: "$items.quantity" },
            },
          },

          // Populate User (Customer)
          {
            $lookup: {
              from: "users",
              let: { userId: "$user_id" },
              pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$userId" }] } } }],
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

          // Final Group by Order
          {
            $group: {
              _id: "$order_id",
              order_id: { $first: "$order_id" },
              user_name: { $first: { $ifNull: ["$user.full_name", "N/A"] } },
              created_at: { $first: "$created_at" },
              payment_method: { $first: "$payment_method" },
              order_status: { $first: "$order_status" },
              suppliers: {
                $push: {
                  supplier_id: "$supplier_id",
                  supplier_name: "$supplier_name",
                  total_amount: "$total_amount",
                  total_quantity: "$total_quantity",
                  items: "$items",
                },
              },
            },
          },

          // Search Functionality
          search
            ? {
                $match: {
                  $or: [
                    { "user.full_name": { $regex: search, $options: "i" } },
                    { order_id: { $regex: search, $options: "i" } },
                  ],
                },
              }
            : null,

          // Sorting
          { $sort: { [sortBy]: order === "desc" ? -1 : 1 } },

          // Pagination
          { $skip: (parsedPage - 1) * parsedLimit },
          { $limit: parsedLimit },

          // Final Projection
          {
            $project: {
              _id: 1,
              order_id: 1,
              order_status: 1,
              payment_method: 1,
              created_at: 1,
              user_name: 1,
              suppliers: 1,
            },
          },
        ].filter(Boolean); // Remove null values

        // Execute query
        const transactions = await Order.aggregate(mainPipeline);

        res.status(200).json({
          message: "Transactions fetched successfully",
          transactions,
          totalPages: Math.ceil(totalTransactions / parsedLimit),
          currentPage: parsedPage,
          totalTransactions,
        });
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ message: "Internal Server Error", status: false });
      }
    });

// const getAllCodTransactionsInAdmin = asyncHandler(async (req, res) => {
//       const { page = 1, limit = 10, sortBy = "created_at", order = "desc", search = "" } = req.query;

//       try {
//         const parsedLimit = parseInt(limit);
//         const parsedPage = parseInt(page);

//         console.log("Fetching transactions...");

//         // Get Total COD Transactions Count
//         const totalTransactionsPipeline = [
//           { $match: { payment_method: "cod" } },
//           { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
//           { $match: { "items.status": "delivered" } },
//           { $group: { _id: "$_id" } }, // Unique orders
//           { $count: "total" },
//         ];

//         const totalResult = await Order.aggregate(totalTransactionsPipeline);
//         const totalTransactions = totalResult.length > 0 ? totalResult[0].total : 0;

//         console.log("Total Transactions After Filtering:", totalTransactions);

//         // Calculate Total COD Transaction Amount
//         const totalAmountPipeline = [
//           { $match: { payment_method: "cod" } },
//           { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
//           { $match: { "items.status": "delivered" } },

//           // Lookup product price
//           {
//             $lookup: {
//               from: "products",
//               let: { productId: "$items.product_id" },
//               pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] } } }],
//               as: "product",
//             },
//           },
//           { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

//           // Compute total price per item
//           {
//             $set: {
//               "items.total_price": { $multiply: ["$items.quantity", "$product.price"] },
//             },
//           },

//           // Sum total price across all orders
//           {
//             $group: {
//               _id: null,
//               total_cod_amount: { $sum: "$items.total_price" },
//             },
//           },
//         ];

//         const totalAmountResult = await Order.aggregate(totalAmountPipeline);
//         const totalCodTransactionAmount = totalAmountResult.length > 0 ? totalAmountResult[0].total_cod_amount : 0;

//         console.log("Total COD Transaction Amount:", totalCodTransactionAmount);

//         // Main Aggregation for Transactions (With Pagination)
//         const mainPipeline = [
//           { $match: { payment_method: "cod" } },
//           { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
//           { $match: { "items.status": "delivered" } },

//           // Populate Product
//           {
//             $lookup: {
//               from: "products",
//               let: { productId: "$items.product_id" },
//               pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] } } }],
//               as: "product",
//             },
//           },
//           { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

//           // Populate Supplier
//           {
//             $lookup: {
//               from: "users",
//               let: { supplierId: "$product.supplier_id" },
//               pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$supplierId" }] } } }],
//               as: "supplier",
//             },
//           },
//           { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },

//           // Compute Total Price
//           {
//             $set: {
//               "items.total_price": { $multiply: ["$items.quantity", "$product.price"] },
//               "items.supplier_name": "$supplier.full_name",
//               "items.supplier_id": "$supplier._id",
//             },
//           },

//           // Group by Order ID and Supplier ID
//           {
//             $group: {
//               _id: {
//                 order_id: "$_id",
//                 supplier_id: "$items.supplier_id",
//               },
//               order_id: { $first: "$_id" },
//               supplier_id: { $first: "$items.supplier_id" },
//               supplier_name: { $first: "$items.supplier_name" },
//               user_id: { $first: "$user_id" },
//               created_at: { $first: "$created_at" },
//               order_status: { $first: "$items.status" },
//               payment_method: { $first: "$payment_method" },
//               items: {
//                 $push: {
//                   product_id: "$items.product_id",
//                   quantity: "$items.quantity",
//                   total_price: "$items.total_price",
//                 },
//               },
//               total_amount: { $sum: "$items.total_price" },
//               total_quantity: { $sum: "$items.quantity" },
//             },
//           },

//           // Populate User (Customer)
//           {
//             $lookup: {
//               from: "users",
//               let: { userId: "$user_id" },
//               pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$userId" }] } } }],
//               as: "user",
//             },
//           },
//           { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

//           // Final Group by Order
//           {
//             $group: {
//               _id: "$order_id",
//               order_id: { $first: "$order_id" },
//               user_name: { $first: { $ifNull: ["$user.full_name", "N/A"] } },
//               created_at: { $first: "$created_at" },
//               payment_method: { $first: "$payment_method" },
//               order_status: { $first: "$order_status" },
//               suppliers: {
//                 $push: {
//                   supplier_id: "$supplier_id",
//                   supplier_name: "$supplier_name",
//                   total_amount: "$total_amount",
//                   total_quantity: "$total_quantity",
//                   items: "$items",
//                 },
//               },
//             },
//           },

//           // Search Functionality
//           search
//             ? {
//                 $match: {
//                   $or: [
//                     { "user.full_name": { $regex: search, $options: "i" } },
//                     { order_id: { $regex: search, $options: "i" } },
//                   ],
//                 },
//               }
//             : null,

//           // Sorting
//           { $sort: { [sortBy]: order === "desc" ? -1 : 1 } },

//           // Pagination
//           { $skip: (parsedPage - 1) * parsedLimit },
//           { $limit: parsedLimit },

//           // Final Projection
//           {
//             $project: {
//               _id: 1,
//               order_id: 1,
//               order_status: 1,
//               payment_method: 1,
//               created_at: 1,
//               user_name: 1,
//               suppliers: 1,
//             },
//           },
//         ].filter(Boolean); // Remove null values

//         // Execute query
//         const transactions = await Order.aggregate(mainPipeline);

//         res.status(200).json({
//           message: "Transactions fetched successfully",
//           transactions,
//           totalPages: Math.ceil(totalTransactions / parsedLimit),
//           currentPage: parsedPage,
//           totalTransactions,
//           totalCodTransactionAmount,
//         });
//       } catch (error) {
//         console.error("Error fetching transactions:", error);
//         res.status(500).json({ message: "Internal Server Error", status: false });
//       }
//     });


module.exports = {
  addTransaction,
  getAllTransactions,
  getAllTransactionsByUser,
  getAllTransactionsByTeacher,
  getAllTransactionsInAdmin,
  getAllCodTransactionsInAdmin,
};
