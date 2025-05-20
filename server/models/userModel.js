import config from "config";
import bcrypt from "bcryptjs";
import gender from "../enum/gender";
import status from "../enum/status";
import userType from "../enum/userType";
import Mongoose, {Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";
const options = {
    collection: "user",
    timestamps: true,
};
const userModel = new Schema(
    {
        fullName: {
            type: String,
        },
        firstName: {type: String},
        lastName: {type: String},
        email: {type: String},
        profilePic: {type: String, default: ""},
        coverImage: {type: String, default: ""},
        coverPic: {type: String},

        gender: {
            type: String,
            enum: [gender.MALE, gender.FEMALE, gender.OTHER, gender.PREFER_NOT_TO_SAY],
        },
        countryCode: {type: String},
        mobileNumber: {type: String, required: true},
        password: {type: String}, 
        otp: {type: Number}, 
        otpExpTime: {type: Number},
        state: {type: String},
        address: {type: String},
        streetName: {type: String},
        buildingName: {type: String},
        city: {type: String},
        zipCode: {type: String},
        location: {
            type: {
                type: String,
                default: "Point",
            },
            coordinates: {
                type: [Number],
                index: "2dsphere",
            },
        },
        dateOfBirth: {type: String},
        country: {type: String},

        notificationEnable: {type: Boolean, default: false},
        otpVerification: {type: Boolean, default: false},
        userType: {
            type: String,
            enum: [userType.ADMIN, userType.USER],
            default: userType.USER,
        },
        status: {
            type: String,
            enum: [status.ACTIVE, status.BLOCKED, status.DELETED],
            default: status.ACTIVE,
        },
        deviceToken: {type: String},
        deviceType: {type: String},
    },
    options
);
userModel.plugin(mongoosePaginate);
userModel.plugin(mongooseAggregatePaginate);
module.exports = Mongoose.model("user", userModel);
(async () => {
    try {
        const result = await Mongoose.model("user", userModel).find({
            userType: userType.ADMIN,
        });
        if (result.length != 0) {
            console.log("Default Admin 😀 .");
        } else {
            const createdRes = await Mongoose.model("user", userModel).create({
                 
                fullName: "Hritik Bhadauria",
                email: "choreohritik52@gmail.com",
                mobileNumber: "7388503329",
                countryCode: "+91",
                dateOfBirth: "20/08/2001",
                gender: gender.MALE,
                password: bcrypt.hashSync("Mobiloitte@1"),
                otpVerification: true,
                status: status.ACTIVE,
                userType: userType.ADMIN,
                state: "Uttar Pradesh",
                address: "Noida",
                location: {
                    type: "Point",
                    coordinates: [77.3706, 28.5774], // [longitude, latitude] as per GeoJSON
                },
                notificationEnable: true,
                deviceToken: "deviceToken",
                deviceType: "deviceType",
                profilePic:
                    "https://img.freepik.com/premium-vector/vector-flat-illustration-software-developer-cyber-program-security_776789-211.jpg",
                coverImage:
                    "https://c8.alamy.com/comp/CY2BHT/web-development-concept-in-word-tag-cloud-on-black-background-CY2BHT.jpg",
            });

            if (createdRes) {
                console.log("DEFAULT ADMIN Created 😀 ", createdRes);
            }
        }
    } catch (error) {
        console.log("Admin error===>>", error);
    }
}).call();
