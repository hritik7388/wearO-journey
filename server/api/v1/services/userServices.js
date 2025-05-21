import userModel from "../../../models/userModel.js"; 
import  status from '../../../enum/status.js';
import userType from "../../../enum/userType.js"; 
const userServices = {
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
}
};

module.exports = { userServices };