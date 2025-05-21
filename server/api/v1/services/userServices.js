import userModel from "../../../models/userModel.js"; 
import  status from '../../../enum/status.js';
import userType from "../../../enum/userType.js"; 
const userServices = {
  userCheck: async (userId) => {
    let query = {
      $and: [
        { status: { $ne: status.DELETE } },
        { $or: [{ email: userId }, { mobileNumber: userId }] },
      ],
    };
    return await userModel.findOne(query);
  },
  allactiveUser: async (query) => {
    return await userModel.count(query);
  },

  checkUserExists: async (mobileNumber, email) => {
    let query = {
      $and: [
        { status: { $ne: status.DELETE } },
        { $or: [{ email: email }, { mobileNumber: mobileNumber }] },
      ],
    };
    return await userModel.findOne(query);
  },

  emailMobileExist: async (mobileNumber, email, id) => {
    let query = {
      $and: [
        { status: { $ne: status.DELETE } },
        { _id: { $ne: id } },
        { $or: [{ email: email }, { mobileNumber: mobileNumber }] },
      ],
    };
    return await userModel.findOne(query);
  },

  checkSocialLogin: async (socialId, socialType) => {
    return await userModel.findOne({
      socialId: socialId,
      socialType: socialType,
    });
  },

  userCount: async () => {
    return await userModel.countDocuments();
  },

  findCount: async (query) => {
    return await userModel.countDocuments(query);
  },

  createUser: async (insertObj) => {
    return await userModel.create(insertObj);
  },
  findFriend: async (query) => {
    return await friendsModel.findOne(query);
  },
  updateFriend: async (query, updateObj) => {
    return await friendsModel
      .findOneAndUpdate(query, updateObj, { new: true })
       
  },

  findUser: async (query) => {
    return await userModel.findOne(query);
  },
  findUserForOtp: async (query) => {
    return await userModel.findOne(query);
  },

  findUserData: async (query) => {
    return await userModel.findOne(query);
  },

  deleteUser: async (query) => {
    return await userModel.deleteOne(query);
  },

  userFindList: async (query) => {
    return await userModel.find(query);
  },

  updateUser: async (query, updateObj) => {
    return await userModel
      .findOneAndUpdate(query, updateObj, { new: true })
      .select("-otp");
  },
  updateUserForOtp: async (query, updateObj) => {
    return await userModel
      .findOneAndUpdate(query, updateObj, { new: true })
  },

  updateUserById: async (query, updateObj) => {
    return await userModel
      .findByIdAndUpdate(query, updateObj, { new: true })
      .select("-otp");
  },

  findfollowers: async (query) => {
    return await userModel
      .findOne(query)
      .populate({ path: "followers" })
      .select("name email profilePic followersCount followingCount");
  },

  findfollowing: async (query) => {
    return await userModel
      .findOne(query)
      .populate({ path: "following" })
      .select("name email profilePic followersCount followingCount");
  },

  insertManyUser: async (obj) => {
    return await userModel.insertMany(obj);
  },
  paginateSearchAllUser: async (validatedBody) => {
    let query = {
        status: { $ne: status.DELETE },
        userType: { $ne: "ADMIN" },
        otpVerification: true,
    };
    const { search, fromDate, toDate, page, limit, status1, userType, kycStatus } = validatedBody;
    if (search) {
        query.$or = [
            { fullName: { $regex: search, $options: "i" } },
            { mobileNumber: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }
    if (userType) {
        query.userType = userType;
    }
    if (kycStatus) {
        query.approveStatus = kycStatus;
    }
    if (status1) {
        query.status = status1;
    }
    if (fromDate && !toDate) {
        query.createdAt = {
            $gte: new Date(new Date(fromDate).toISOString().slice(0, 10)),
        };
    }
    if (!fromDate && toDate) {
        query.createdAt = {
            $lte: new Date(
                new Date(toDate).toISOString().slice(0, 10) + "T23:59:59.999Z"
            ),
        };
    }
    if (fromDate && toDate) {
        query.$and = [
            {
                createdAt: {
                    $gte: new Date(new Date(fromDate).toISOString().slice(0, 10)),
                },
            },
            {
                createdAt: {
                    $lte: new Date(
                        new Date(toDate).toISOString().slice(0, 10) + "T23:59:59.999Z"
                    ),
                },
            },
        ];
    }

    let aggregate = userModel.aggregate([
        {
            $match: query
        },
        {
            $lookup: {
                from: "kyc",
                localField: "_id",
                foreignField: "userId",
                as: "kycDetails"
            }
        },
        {
            $unwind: {
                path: "$kycDetails",
                preserveNullAndEmptyArrays: true
            },
        }
        // No $lookup for walletDetails here to exclude it from the response
    ]);

    let options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: { createdAt: -1 }
    };

    return await userModel.aggregatePaginate(aggregate, options);
},
//   


  paginateSearch: async (validatedBody) => {
    let query = {status: { $ne: status.DELETE },userType: { $ne: "ADMIN" },otpVerification: true, };
    const { search, fromDate, toDate, page, limit, status1, userType,} = validatedBody;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (userType) {
      query.userType = userType;
    }
    
    if (status1) {
      query.status = status1;
    }
    if (fromDate && !toDate) {
      query.createdAt = {
        $gte: new Date(new Date(fromDate).toISOString().slice(0, 10)),
      };
    }
    if (!fromDate && toDate) {
      query.createdAt = {
        $lte: new Date(
          new Date(toDate).toISOString().slice(0, 10) + "T23:59:59.999Z"
        ),
      };
    }
    if (fromDate && toDate) {
      query.$and = [
        {
          createdAt: {
            $gte: new Date(new Date(fromDate).toISOString().slice(0, 10)),
          },
        },
        {
          createdAt: {
            $lte: new Date(
              new Date(toDate).toISOString().slice(0, 10) + "T23:59:59.999Z"
            ),
          },
        },
      ];
    }
    
          let options = {
              page: parseInt(page) || 1,
              limit: parseInt(limit) || 10,
              sort: { createdAt: -1 }
          }
        
          return await userModel.aggregatePaginate(options);
  },

  aggregateSearchUser: async (validatedBody) => {
    try {
      const {  search,  fromDate,  toDate,  page,  limit, status1, approveStatus } = validatedBody;
      if (approveStatus) {
        var filter = approveStatus;
      }
      let data = filter || "";
      let searchData = [
        {
          $lookup: {
            from: "kyc",
            localField: "_id",
            foreignField: "userId",
            as: "kycDetails",
          },
        },
        {
          $lookup: {
            from: "wallet",
            localField: "_id",
            foreignField: "userId",
            as: "walletDetails",
          },
        },
        {
          $unwind: {
            path: "$kycDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: "$walletDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            $or: [
              { "kycDetails.approveStatus": { $regex: data, $options: "i" } },
              // { "walletDetails.fullName": { $regex: data, $options: "i" } },
            ],
          },
        },
        {
          $match: { status: status.ACTIVE },
        },
        { $sort: { createdAt: -1 } },
      ];
      if (search) {
        searchData.push({
          $match: {
            $or: [
              { fullName: { $regex: search, $options: "i" } },
              { mobileNumber: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ]
          } 
        })
      }
      if (status1) {
        searchData.push({
          $match: { status: status1 },
        });
      }
      if (fromDate && !toDate) {
        searchData.push({
          $match: {
            // "$expr": { "$gte": ["$createdAt", new Date(fromDate)] }
            $expr: {
              $lte: [
                "$createdAt",
                new Date(
                  new Date(toDate).toISOString().slice(0, 10) + "T23:59:59.999Z"
                ),
              ],
            },
          },
        });
      }
      if (!fromDate && toDate) {
        searchData.push({
          $match: {
            // "$expr": { "$lte": ["$createdAt", new Date(toDate)] }
            $expr: {
              $lte: [
                "$createdAt",
                new Date(
                  new Date(toDate).toISOString().slice(0, 10) + "T23:59:59.999Z"
                ),
              ],
            },
          },
        });
      }
      if (fromDate && toDate) {
        searchData.push({
          $match: {
            // "$expr": { "$and": [{ "$lte": ["$createdAt", new Date(toDate)] }, { "$gte": ["$createdAt", new Date(fromDate)] }] }
            $expr: {
              $and: [
                {
                  $lte: [
                    "$createdAt",
                    new Date(
                      new Date(toDate).toISOString().slice(0, 10) +
                        "T23:59:59.999Z"
                    ),
                  ],
                },
                {
                  $gte: [
                    "$createdAt",
                    new Date(new Date(fromDate).toISOString().slice(0, 10)),
                  ],
                },
              ],
            },
          },
        });
      }
      let aggregate = userModel.aggregate(searchData);
      let options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: { createdAt: -1 },
        populate: ["fromCoinId", "toCoinId"],
      };
      return await userModel.aggregatePaginate(aggregate, options);
    } catch (error) {
      console.log("aggregateSearchExchange error==>>", error);
    }
  },

  userCount: async () => {
    return await userModel.countDocuments();
  },

  userList: async (validatedBody) => {
    let query = { status: { $ne: status.DELETE }, userType: userType.USER };
    const { search, fromDate, toDate, page, limit } = validatedBody;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { walletAddress: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
      ];
    }
    if (fromDate && !toDate) {
      query.createdAt = { $gte: fromDate };
    }
    if (!fromDate && toDate) {
      query.createdAt = { $lte: toDate };
    }
    if (fromDate && toDate) {
      query.$and = [
        { createdAt: { $gte: fromDate } },
        { createdAt: { $lte: toDate } },
      ];
    }
    let options = {
      page: page || 1,
      limit: limit || 10,
      sort: { createdAt: -1 },
    };
    return await userModel.paginate(query, options);
  },

  insertManyUser: async (obj) => {
    return await userModel.insertMany(obj);
  },

  findUserLastSeen: async (query) => {
    return await userModel.findOne(query);
  },

  findAllReferralList: async (query) => {
    return await userModel
      .find(query)
      .select(
        "firstName lastName userName email countryCode mobileNumber profilePic coverPic coverImage gender "
      );
  }
};

module.exports = { userServices };